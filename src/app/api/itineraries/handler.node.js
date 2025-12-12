// src/app/api/itineraries/handler.node.js
// PURE NODE CJS MODULE — safe for Vercel & Next.js

const OpenAI = require("openai");

/* ------------------------------------------------------------------
   CONFIG & CONSTANTS
-------------------------------------------------------------------*/

const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_MAX_TOKENS = 6000;

const DEFAULT_LOCATION = {
  lat: -12.4634,
  lon: 130.8456, // Darwin
};

const MAX_DAYS = 14;
const MAX_ACTIVITIES_PER_DAY = 10;
const FETCH_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------
   SAFE FETCH WITH TIMEOUT
-------------------------------------------------------------------*/

async function safeFetch(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (err) {
    console.error("safeFetch error:", err?.message || err);
    return null;
  } finally {
    clearTimeout(id);
  }
}

/* ------------------------------------------------------------------
   OPENAI CLIENT
-------------------------------------------------------------------*/

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

/* ------------------------------------------------------------------
   OPENWEATHER
-------------------------------------------------------------------*/

async function getWeather(lat, lon) {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) {
      console.warn("OPENWEATHER_API_KEY not set – skipping weather.");
      return null;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
    const res = await safeFetch(url);
    if (!res || !res.ok) return null;

    return await res.json();
  } catch (err) {
    console.error("Weather error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------
   GOOGLE PLACES
-------------------------------------------------------------------*/

async function fetchPlaceDetails(query, apiKey) {
  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY not set – skipping place details.");
    return null;
  }

  try {
    const textURL = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const tRes = await safeFetch(textURL);
    if (!tRes || !tRes.ok) return null;

    const tJson = await tRes.json();
    const item = tJson.results?.[0];
    if (!item) return null;

    const placeId = item.place_id;

    const detailURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry,opening_hours,photos,types,formatted_address,url&key=${apiKey}`;
    const dRes = await safeFetch(detailURL);
    if (!dRes || !dRes.ok) return null;

    const dJson = await dRes.json();
    if (!dJson.result) return null;

    const r = dJson.result;

    return {
      name: r.name,
      address: r.formatted_address,
      types: r.types || [],
      lat: r.geometry?.location?.lat,
      lon: r.geometry?.location?.lng,
      opening_hours: r.opening_hours || null,
      photo_reference: r.photos?.[0]?.photo_reference || null,
      url: r.url || null,
      place_id: placeId
    };
  } catch (err) {
    console.error("fetchPlaceDetails error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------
   GOOGLE PHOTO URL
-------------------------------------------------------------------*/

function makePhotoURL(photoRef, apiKey) {
  if (!photoRef || !apiKey) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=${photoRef}&key=${apiKey}`;
}

/* ------------------------------------------------------------------
   UNSPLASH FALLBACK
-------------------------------------------------------------------*/

async function unsplashFallback(query) {
  const key = process.env.UNSPLASH_KEY;
  if (!key) {
    console.warn("UNSPLASH_KEY not set – skipping fallback images.");
    return null;
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${key}&orientation=landscape&per_page=1`;
    const res = await safeFetch(url);
    if (!res || !res.ok) return null;

    const json = await res.json();
    return json.results?.[0]?.urls?.regular || null;
  } catch (err) {
    console.error("unsplashFallback error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------
   GPT PROMPT
-------------------------------------------------------------------*/

function buildGPTPrompt(userPrompt, weather) {
  return `
You are TripPuddy — an expert AI travel planner.

RULES:
- Detect exact number of days from user prompt.
- ALWAYS output EXACTLY that number of days.
- 4–7 activities per day.
- Each day must start in the MORNING (08:00–09:30).
- Include realistic arrival_time, duration_minutes, and departure_time.
- Use weather to adjust outdoor activities.
- Every activity must have a real Google-searchable place.

OUTPUT FORMAT (STRICT JSON ONLY):

{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "title": "",
          "category": "",
          "time_of_day": "",
          "arrival_time": "",
          "duration_minutes": 0,
          "suggested_departure_time": "",
          "distance_km_from_previous": 0,
          "travel_time_minutes_from_previous": 0,
          "google_maps_query": "",
          "latitude": 0,
          "longitude": 0,
          "estimated_cost": "",
          "opening_hours_info": "",
          "description": ""
        }
      ]
    }
  ]
}

USER PROMPT: "${userPrompt}"
WEATHER: ${JSON.stringify(weather)}
`;
}

/* ------------------------------------------------------------------
   NORMALIZE ITINERARY
-------------------------------------------------------------------*/

function normalizeItinerary(raw) {
  if (!raw || !raw.days || !Array.isArray(raw.days)) {
    return { days: [] };
  }

  const limited = raw.days.slice(0, MAX_DAYS).map((day, index) => ({
    day: day.day ?? index + 1,
    activities: Array.isArray(day.activities)
      ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY)
      : []
  }));

  return { days: limited };
}

/* ------------------------------------------------------------------
   ENSURE MORNING START
-------------------------------------------------------------------*/

function ensureMorningStart(days) {
  for (const day of days) {
    if (!day.activities?.length) continue;

    const first = day.activities[0];

    first.time_of_day = "Morning";
    first.arrival_time = first.arrival_time || "09:00";
    first.suggested_departure_time =
      first.suggested_departure_time || "10:30";
    first.duration_minutes = first.duration_minutes || 90;
  }

  return days;
}

/* ------------------------------------------------------------------
   VALIDATE & FIX ACTIVITIES
-------------------------------------------------------------------*/

async function validateAndFixActivities(days, apiKey, weather) {
  const month = new Date().getMonth() + 1;
  const wetSeason = month >= 11 || month <= 4;
  const heavyRain = weather?.weather?.[0]?.main?.toLowerCase()?.includes("rain");

  const weatherLink = weather
    ? `https://openweathermap.org/weathermap?basemap=map&layers=temperature&lat=${weather.coord.lat}&lon=${weather.coord.lon}&zoom=10`
    : null;

  for (const day of days) {
    const fixed = [];

    for (const a of day.activities || []) {
      const query = a.google_maps_query || a.title;
      if (!query) continue;

      const place = await fetchPlaceDetails(query, apiKey);

      if (!place) {
        fixed.push({
          ...a,
          title: a.title || query,
          latitude: a.latitude ?? null,
          longitude: a.longitude ?? null,
          image: null,
          google_maps_query: query,
          weather: weather
            ? {
                temp: weather.main?.temp ?? null,
                description: weather.weather?.[0]?.description ?? null,
                icon: weather.weather?.[0]?.icon ?? null,
                link: weatherLink
              }
            : null
        });
        continue;
      }

      // Skip certain places in wet season / heavy rain
      if (wetSeason && /mindil/i.test(place.name)) continue;
      if (
        heavyRain &&
        /beach|lookout|reserve|trail|national|cliff|coast/i.test(place.name)
      ) {
        continue;
      }

      const image =
        makePhotoURL(place.photo_reference, apiKey) ||
        (await unsplashFallback(place.name));

      fixed.push({
        ...a,
        title: place.name,
        latitude: place.lat,
        longitude: place.lon,
        google_maps_query: place.name,
        image,
        weather: weather
          ? {
              temp: weather.main?.temp ?? null,
              description: weather.weather?.[0]?.description ?? null,
              icon: weather.weather?.[0]?.icon ?? null,
              link: weatherLink
            }
          : null
      });
    }

    if (fixed.length === 0) {
      fixed.push({
        title: "Darwin Waterfront Precinct",
        time_of_day: "Morning",
        arrival_time: "09:00",
        suggested_departure_time: "10:30",
        google_maps_query: "Darwin Waterfront Precinct",
        latitude: -12.4662,
        longitude: 130.8464,
        description: "Relax at the lagoon and explore the waterfront.",
        estimated_cost: "Free"
      });
    }

    day.activities = fixed;
  }

  return days;
}

/* ------------------------------------------------------------------
   MAIN HANDLER EXPORT
-------------------------------------------------------------------*/

module.exports = async function handleItineraryRequest(input) {
  try {
    const data = input && typeof input === "object" ? input : {};

    let userPrompt = data.userPrompt;
    if (typeof userPrompt !== "string" || !userPrompt.trim()) {
      return {
        ok: false,
        error: "userPrompt is required and must be a non-empty string."
      };
    }
    userPrompt = userPrompt.trim();

    let userLocation = data.userLocation;
    if (
      !userLocation ||
      typeof userLocation.lat !== "number" ||
      typeof userLocation.lon !== "number"
    ) {
      userLocation = { ...DEFAULT_LOCATION };
    }

    // Weather
    const weather = await getWeather(userLocation.lat, userLocation.lon);

    // Build GPT prompt
    const gptPrompt = buildGPTPrompt(userPrompt, weather);

    // GPT call
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Return ONLY valid JSON. No markdown." },
        { role: "user", content: gptPrompt }
      ],
      temperature: 0.5,
      max_tokens: OPENAI_MAX_TOKENS
    });

    let raw = completion.choices[0]?.message?.content || "";
    raw = raw.replace(/```json|```/g, "").trim();

    let itinerary;

    try {
      itinerary = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse GPT JSON:", err);
      itinerary = { days: [] };
    }

    // Normalize
    itinerary = normalizeItinerary(itinerary);

    // Fix morning start
    itinerary.days = ensureMorningStart(itinerary.days);

    // Validate/fix activities
    itinerary.days = await validateAndFixActivities(
      itinerary.days,
      process.env.GOOGLE_PLACES_API_KEY,
      weather
    );

    return { ok: true, itinerary, weather, userLocation };
  } catch (err) {
    console.error("🔥 SERVER ERROR (handler.node.js):", err);
    return {
      ok: false,
      error: "Itinerary generation failed",
      details: String(err?.message || err)
    };
  }
};
