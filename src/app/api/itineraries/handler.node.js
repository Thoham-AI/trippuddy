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
   IMAGE FETCH (kept, but safe)
---------------------------------------------------------------*/
async function getImage(query) {
  const key = process.env.UNSPLASH_KEY;
  if (!key) return null;

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    query
  )}&client_id=${key}&orientation=landscape&per_page=1`;

  const res = await safeFetch(url);
  if (!res || !res.ok) return null;

  const json = await res.json();
  return json.results?.[0]?.urls?.regular || null;
}

/* ---------------------------------------------------------------
   GPT PROMPT (unchanged)
---------------------------------------------------------------*/
function buildPrompt(prompt) {
  return `
You are TripPuddy, an expert travel planner.

Rules:
- Detect number of days from user input
- Output EXACTLY that many days
- 4–6 activities per day
- Morning start (08:00–09:30)
- Real places only

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

    const client = await getOpenAI();

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: buildPrompt(userPrompt) },
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

    // enforce shape
    const days = Array.isArray(itinerary.days)
      ? itinerary.days.slice(0, MAX_DAYS)
      : [];

    // hydrate images without blocking GPT JSON
    await Promise.allSettled(
      days.map(async (day) => {
        day.activities = Array.isArray(day.activities)
          ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY)
          : [];

        await Promise.allSettled(
          day.activities.map(async (a) => {
            if (!a.image && a.title) {
              a.image = await getImage(a.title);
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
