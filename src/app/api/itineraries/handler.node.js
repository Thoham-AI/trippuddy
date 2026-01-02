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
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/* ---------------------------------------------------------------
   DESTINATION HINT (new)
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
  const startMatch = text.match(/^([A-Za-z][A-Za-z\s-]{2,})(?:\s+\d+\s+day|\s+\d+\s+days|\s+day|\s+days)\b/i);
  if (startMatch?.[1]) return startMatch[1].trim();

  // Lightweight keyword fallbacks (optional; keeps behavior stable)
  const p = text.toLowerCase();
  if (p.includes("singapore")) return "Singapore";
  if (p.includes("hanoi")) return "Hanoi";
  if (p.includes("ho chi minh") || p.includes("saigon")) return "Ho Chi Minh City";

  return "";
}

/* ---------------------------------------------------------------
   HYBRID IMAGE RESOLVER
---------------------------------------------------------------*/
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  // Vercel provides VERCEL_URL without protocol
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Fallback for local dev
  return "http://localhost:3000";
}

async function resolveImage(a, destinationHint = "") {
  try {
    // Bias the query toward the destination to prevent cross-city drift (e.g., Adelaide)
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
   GPT PROMPT (updated with destination constraint)
---------------------------------------------------------------*/
function buildPrompt(prompt, destinationHint = "") {
  return `
You are TripPuddy, an expert travel planner.

Rules:
- Detect number of days from user input
- Output EXACTLY that many days
- 4–6 activities per day
- Morning start (08:00–09:30)
- Real places only
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

    // Destination hint used BOTH for the LLM constraint and for image/geo lookup bias
    const destinationHint = extractDestinationHint(userPrompt);

    const client = await getOpenAI();

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: buildPrompt(userPrompt, destinationHint) },
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

    /* -------------------- IMAGE HYDRATION (HYBRID) -------------------- */
    await Promise.allSettled(
      days.map(async (day) => {
        day.activities = Array.isArray(day.activities)
          ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY)
          : [];

        await Promise.allSettled(
          day.activities.map(async (a) => {
            if (!a.title) return;

            // Hydrate image + coordinates (when available) per activity.
            // This prevents wrong-map-center issues caused by missing coords.
            if (!a.image || !a.latitude || !a.longitude || !a.website || !a.mapsUrl) {
              const resolved = await resolveImage(a, destinationHint);

              if (!a.image && resolved?.url) a.image = resolved.url;

              const p = resolved?.place;
              if (p) {
                if (!a.placeId && p.placeId) a.placeId = p.placeId;
                if (!a.latitude && Number.isFinite(Number(p.lat))) a.latitude = Number(p.lat);
                if (!a.longitude && Number.isFinite(Number(p.lon))) a.longitude = Number(p.lon);

                // ✅ Official website ONLY (so pink pin truly means "website")
                if (!a.website && p.website) {
                  a.website = p.website;
                }

                // ✅ Keep Google Maps place page separately for fallback
                if (!a.mapsUrl && p.url) {
                  a.mapsUrl = p.url;
                }

                // UI expects act.coordinates = { lat, lon }
                if (
                  !a.coordinates &&
                  Number.isFinite(Number(a.latitude)) &&
                  Number.isFinite(Number(a.longitude))
                ) {
                  a.coordinates = { lat: Number(a.latitude), lon: Number(a.longitude) };
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
    return { ok: false, error: "Itinerary generation failed" };
  }
}
