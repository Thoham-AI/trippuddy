// src/app/api/itineraries/handler.node.js
// SAFE server-only execution — no build-time side effects

/* ---------------------------------------------------------------
   DYNAMIC IMPORT: avoids Vercel bundling failures
---------------------------------------------------------------*/
async function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const OpenAI = (await import("openai")).default;
  return new OpenAI({ apiKey: key });
}

/* ---------------------------------------------------------------
   CONSTANTS (unchanged)
---------------------------------------------------------------*/
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_MAX_TOKENS = 5000;

const DEFAULT_LOCATION = {
  lat: 21.0285,
  lon: 105.8542,
};

const MAX_DAYS = 14;
const MAX_ACTIVITIES_PER_DAY = 8;

/* ---------------------------------------------------------------
   SAFE FETCH (unchanged)
---------------------------------------------------------------*/
async function safeFetch(url, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": process.env.OSM_USER_AGENT || "travel-ai-app",
        Accept: "application/json",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/* ---------------------------------------------------------------
   CITY RESOLUTION (new)
   - Reverse geocode userLocation to a city/town/suburb name via OSM Nominatim
   - Used to decide whether to force "breakfast first" and to anchor the trip city
---------------------------------------------------------------*/
function normalizeCityName(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z\s-]/g, "");
}

function cityMatches(a, b) {
  const A = normalizeCityName(a);
  const B = normalizeCityName(b);
  if (!A || !B) return false;
  if (A === B) return true;
  if (A.startsWith(B) || B.startsWith(A)) return true;
  return false;
}

async function reverseGeocodeCity(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return "";
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`;

  const res = await safeFetch(url, 8000);
  if (!res || !res.ok) return "";

  let data;
  try {
    data = await res.json();
  } catch {
    return "";
  }

  const addr = data?.address || {};
  return (
    addr.city ||
    addr.town ||
    addr.suburb ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    ""
  );
}

function isMindilLikelyClosedNow() {
  // Mindil Beach Sunset Market is typically a dry-season market (roughly Apr–Oct).
  // When the user did not provide travel dates, we avoid it in the wet season (Nov–Mar).
  const m = new Date().getMonth() + 1; // 1..12
  return m === 11 || m === 12 || m === 1 || m === 2 || m === 3;
}

/* ---------------------------------------------------------------
   DESTINATION HINT
   Purpose: keep itinerary + image/geo hydration locked to the same city
---------------------------------------------------------------*/
function extractDestinationHint(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") return "";
  const text = userPrompt.trim();

  // Most common: "1 day in Singapore", "3 days in Ho Chi Minh City"
  const inMatch = text.match(/\bin\s+([A-Za-z][A-Za-z\s-]{2,})(?:[,.]|$)/i);
  if (inMatch?.[1]) return inMatch[1].trim();

  // Other common: "Singapore 1 day itinerary"
  // Heuristic: if the prompt starts with a place name (first 1-4 words) before "day/days"
  const startMatch = text.match(
    /^([A-Za-z][A-Za-z\s-]{2,})(?:\s+\d+\s+day|\s+\d+\s+days|\s+day|\s+days)\b/i
  );
  if (startMatch?.[1]) return startMatch[1].trim();

  // Lightweight keyword fallbacks
  const p = text.toLowerCase();
  if (p.includes("singapore")) return "Singapore";
  if (p.includes("hanoi")) return "Hanoi";
  if (p.includes("ho chi minh") || p.includes("saigon"))
    return "Ho Chi Minh City";

  if (p.includes("darwin")) return "Darwin";
  if (p.includes("alice springs") || p.includes("alicesprings"))
    return "Alice Springs";
  if (p.includes("adelaide")) return "Adelaide";

  return "";
}

/* ---------------------------------------------------------------
   HYBRID IMAGE RESOLVER
---------------------------------------------------------------*/
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function resolveImage(a, destinationHint = "") {
  try {
    const baseTitle = a.title || "tourist attraction";
    const queryText = destinationHint ? `${baseTitle}, ${destinationHint}` : baseTitle;

    const query = encodeURIComponent(queryText);
    const placeIdParam = a.placeId ? `&placeId=${a.placeId}` : "";

    const res = await fetch(
      `${getBaseUrl()}/api/images?q=${query}${placeIdParam}&limit=1`
    );

    const data = await res.json();

    return {
      url: data?.images?.[0]?.url || null,
      place: data?.place || null,
    };
  } catch {
    return { url: null, place: null };
  }
}

/* ---------------------------------------------------------------
   GPT PROMPT (updated: smart breakfast, seasonal avoidance, timing sanity)
---------------------------------------------------------------*/
function buildPrompt(
  prompt,
  destinationHint = "",
  requireBreakfast = false,
  userCity = "",
  tripCity = ""
) {
  return `
You are TripPuddy, an expert travel planner.

Rules:
- Detect number of days from user input
- Output EXACTLY that many days
- 4–6 activities per day
- Morning start (08:00–09:30)
- Real places only
${tripCity ? `- Trip city: ${tripCity}.\n` : ``}${userCity ? `- User current city (from location): ${userCity}.\n` : ``}
- Always include at least one food recommendation per day (breakfast/brunch/lunch/dinner), using real places.
${requireBreakfast ? `- If the user is already in the same city as the trip destination, the FIRST activity of EACH day MUST be a breakfast/brunch/coffee place (suitable for 08:00–09:30).\n` : ``}
- Respect typical opening hours and common sense timing:
  - Sunset/night markets MUST be scheduled late afternoon/evening (never morning).
  - Do not schedule nightlife/late venues in the morning.
- If the user did NOT provide travel dates, avoid highly seasonal events/markets that may be closed.
  - Prefer always-open alternatives (parks, museums, viewpoints, neighborhoods, well-known restaurants/cafes).
  - For Darwin specifically, avoid Mindil Beach Sunset Market unless the user explicitly provides dates in the dry season (roughly Apr–Oct).
${destinationHint ? `- ALL activities MUST be within ${destinationHint}. Do NOT include any place outside ${destinationHint}.` : ""}

Return STRICT JSON:

{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "title": "",
          "arrival_time": "",
          "duration_minutes": 90,
          "description": ""
        }
      ]
    }
  ]
}

USER INPUT:
"${prompt}"
`;
}

/* ---------------------------------------------------------------
   MAIN HANDLER — core logic preserved
---------------------------------------------------------------*/
export async function handleItineraryRequest(input) {
  try {
    if (!input || typeof input.userPrompt !== "string") {
      return { ok: false, error: "Invalid input" };
    }

    const userPrompt = input.userPrompt.trim();
    const userLocation = input.userLocation || DEFAULT_LOCATION;

    const destinationHint = extractDestinationHint(userPrompt);

    // Resolve user's current city from lat/lon (used to decide breakfast-first behavior)
    const userCity = await reverseGeocodeCity(userLocation?.lat, userLocation?.lon);

    // Decide trip city:
    // - Prefer explicit destination in the prompt
    // - Otherwise, if the prompt is vague, fall back to user's current city
    const tripCity = destinationHint || userCity || "";

    // Only force "breakfast first" when user is already in the same city as the trip
    const requireBreakfast = cityMatches(userCity, tripCity);

    const client = await getOpenAI();

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Return JSON only." },
        {
          role: "user",
          content: buildPrompt(userPrompt, destinationHint, requireBreakfast, userCity, tripCity),
        },
      ],
      temperature: 0.5,
      max_tokens: OPENAI_MAX_TOKENS,
    });

    let raw = completion.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let itinerary;
    try {
      itinerary = JSON.parse(raw);
    } catch {
      itinerary = { days: [] };
    }

    const days = Array.isArray(itinerary.days)
      ? itinerary.days.slice(0, MAX_DAYS)
      : [];

    /* -------------------- POST-PROCESS SANITY (new) --------------------
       - If no explicit travel dates were provided, avoid known seasonal/closed items
       - In Darwin wet season, remove Mindil Beach Sunset Market suggestions
    -------------------------------------------------------------------*/
    const promptHasDates =
      /\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
        userPrompt
      );

    if (!promptHasDates && isMindilLikelyClosedNow()) {
      for (const day of days) {
        if (!Array.isArray(day.activities)) continue;
        for (const a of day.activities) {
          const t = (a?.title || "").toString().toLowerCase();
          if (t.includes("mindil") && t.includes("market")) {
            a.title = "Lunch at Darwin Waterfront Precinct";
            a.description =
              "Enjoy lunch at the Darwin Waterfront precinct with a choice of cafes and restaurants, then take a stroll along the harbour views.";
            // Clear prior place data so hydration fetches correct Darwin coordinates/website
            a.image = null;
            a.placeId = null;
            a.latitude = null;
            a.longitude = null;
            a.coordinates = null;
            a.website = null;
            a.mapsUrl = null;
          }
        }
      }
    }

    /* -------------------- IMAGE HYDRATION (HYBRID) -------------------- */
    await Promise.allSettled(
      days.map(async (day) => {
        day.activities = Array.isArray(day.activities)
          ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY)
          : [];

        await Promise.allSettled(
          day.activities.map(async (a) => {
            if (!a.title) return;

            if (
              !a.image ||
              !a.latitude ||
              !a.longitude ||
              !a.website ||
              !a.mapsUrl
            ) {
              // Bias toward the trip city to avoid cross-city drift (e.g., Brisbane)
              const resolved = await resolveImage(a, tripCity || destinationHint);

              if (!a.image && resolved?.url) a.image = resolved.url;

              const p = resolved?.place;
              if (p) {
                if (!a.placeId && p.placeId) a.placeId = p.placeId;
                if (!a.latitude && Number.isFinite(Number(p.lat)))
                  a.latitude = Number(p.lat);
                if (!a.longitude && Number.isFinite(Number(p.lon)))
                  a.longitude = Number(p.lon);

                // Official website for the pink pin
                if (!a.website && p.website) {
                  a.website = p.website;
                }

                // Google Maps place page for fallback
                if (!a.mapsUrl && p.url) {
                  a.mapsUrl = p.url;
                }

                if (
                  !a.coordinates &&
                  Number.isFinite(Number(a.latitude)) &&
                  Number.isFinite(Number(a.longitude))
                ) {
                  a.coordinates = {
                    lat: Number(a.latitude),
                    lon: Number(a.longitude),
                  };
                }
              }
            }
          })
        );
      })
    );

    return {
      ok: true,
      itinerary: { days },
      userLocation,
    };
  } catch (err) {
    console.error("ITINERARY HANDLER ERROR:", err);
    return { ok: false, error: "Itinerary generation failed" }
;
  }
}
