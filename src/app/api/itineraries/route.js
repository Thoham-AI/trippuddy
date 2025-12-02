import { NextResponse } from "next/server";
import OpenAI from "openai";

// -----------------------------------------------------------
// INIT GPT CLIENT (FIXES "client is not defined")
// -----------------------------------------------------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -----------------------------------------------------------
// WEATHER FETCH
// -----------------------------------------------------------
async function getWeather(lat, lon) {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return null;

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error("Weather error:", err);
    return null;
  }
}

// -----------------------------------------------------------
// GOOGLE PLACE TEXTSEARCH + DETAILS LOOKUP
// -----------------------------------------------------------
async function fetchPlaceDetails(query, apiKey) {
  try {
    const textURL = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${apiKey}`;

    const tRes = await fetch(textURL);
    const tJson = await tRes.json();

    const item = tJson.results?.[0];
    if (!item) return null;

    const placeId = item.place_id;

    const detailURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry,opening_hours,photos,types,formatted_address&key=${apiKey}`;

    const dRes = await fetch(detailURL);
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
      place_id: placeId,
    };
  } catch (e) {
    console.log("fetchPlaceDetails error:", e);
    return null;
  }
}

// -----------------------------------------------------------
// GOOGLE PHOTO URL
// -----------------------------------------------------------
function makePhotoURL(photoRef, apiKey) {
  if (!photoRef) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${apiKey}`;
}

// -----------------------------------------------------------
// UPGRADED GPT PROMPT
// -----------------------------------------------------------
function buildGPTPrompt(userPrompt, weather) {
  return `
You are an expert travel planner producing itineraries using ONLY real places found on Google Maps.

STRICT RULES:
- JSON ONLY.
- All activities must be REAL, OPEN, and available.
- All locations must be valid Google Maps results.
- Must include title, time_of_day, category, cost, query, lat, lon, description.
- At least 4 activities for a 1-day itinerary.
- Morning = 7-11, Midday = 11-2, Afternoon = 2-5, Evening = 5-9.
- Mindil Beach Sunset Market is CLOSED Nov–Apr.
- No sunset markets in the morning.
- Weather-aware: avoid beaches / lookouts / walks in heavy rain.

Return only:
{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "title": "",
          "category": "",
          "time_of_day": "",
          "description": "",
          "estimated_cost": "",
          "google_maps_query": "",
          "latitude": 0,
          "longitude": 0
        }
      ]
    }
  ]
}

User request: "${userPrompt}"
Weather: ${JSON.stringify(weather)}
`;
}

// -----------------------------------------------------------
// NORMALIZER
// -----------------------------------------------------------
function normalizeItinerary(raw) {
  if (!raw) return { days: [{ day: 1, activities: [] }] };

  if (Array.isArray(raw.days)) return raw;

  if (Array.isArray(raw.activities))
    return { days: [{ day: 1, activities: raw.activities }] };

  if (raw.itinerary?.activities)
    return { days: [{ day: 1, activities: raw.itinerary.activities }] };

  return { days: [{ day: 1, activities: [] }] };
}

// -----------------------------------------------------------
// VALIDATE + FIX ACTIVITIES USING GOOGLE PLACES
// -----------------------------------------------------------
async function validateAndFixActivities(days, apiKey, weather) {
  const month = new Date().getMonth() + 1;
  const wetSeason = month >= 11 || month <= 4;
  const heavyRain =
    weather?.weather?.[0]?.main?.toLowerCase()?.includes("rain") ?? false;

  for (const day of days) {
    const valid = [];

    for (const act of day.activities) {
      const q = act.google_maps_query || act.title;

      const place = await fetchPlaceDetails(q, apiKey);
      if (!place) continue;

      // Seasonal rule
      if (wetSeason && /mindil/i.test(place.name)) continue;

      // No sunset markets in the morning
      const tod = act.time_of_day?.toLowerCase() || "";
      if (tod.includes("morning") && /sunset|market/i.test(place.name))
        continue;

      // Weather constraint
      if (heavyRain && /beach|lookout|reserve|trail/i.test(place.name))
        continue;

      valid.push({
        ...act,
        title: place.name,
        latitude: place.lat,
        longitude: place.lon,
        google_maps_query: place.name,
        image: makePhotoURL(place.photo_reference, apiKey),
      });
    }

    day.activities = valid;
  }

  return days;
}

// -----------------------------------------------------------
// DARWIN FALLBACK
// -----------------------------------------------------------
function buildFallbackDarwin() {
  return {
    days: [
      {
        day: 1,
        activities: [
          {
            title: "Darwin Waterfront Precinct",
            category: "relaxing",
            time_of_day: "Morning",
            estimated_cost: "Free–$15",
            google_maps_query: "Darwin Waterfront Precinct",
            latitude: -12.4662,
            longitude: 130.8464,
            description:
              "Relax, swim or enjoy cafes by the waterfront.",
          },
          {
            title: "MAGNT Museum",
            category: "culture",
            time_of_day: "Midday",
            estimated_cost: "Free",
            google_maps_query: "MAGNT Darwin",
            latitude: -12.4402,
            longitude: 130.8323,
            description:
              "Explore Cyclone Tracy exhibit and NT art collections.",
          },
          {
            title: "Wave Lagoon",
            category: "adventure",
            time_of_day: "Afternoon",
            estimated_cost: "$15–20",
            google_maps_query: "Darwin Wave Lagoon",
            latitude: -12.4665,
            longitude: 130.8477,
            description: "Fun wave pool at the waterfront.",
          },
          {
            title: "East Point Reserve Sunset",
            category: "nature",
            time_of_day: "Evening",
            estimated_cost: "Free",
            google_maps_query: "East Point Reserve",
            latitude: -12.4088,
            longitude: 130.818,
            description: "One of Darwin’s best sunset spots.",
          },
        ],
      },
    ],
  };
}

// -----------------------------------------------------------
// MAIN POST HANDLER
// -----------------------------------------------------------
export async function POST(req) {
  console.log("---- API HIT ----");

  try {
    const body = await req.text();
    const data = JSON.parse(body || "{}");

    let { userPrompt, userLocation } = data;

    if (!userLocation?.lat || !userLocation?.lon) {
      console.log("⚠ No user location → Darwin fallback");
      userLocation = { lat: -12.4634, lon: 130.8456 };
    }

    const weather = await getWeather(userLocation.lat, userLocation.lon);

    // GPT Call
    const gptPrompt = buildGPTPrompt(userPrompt, weather);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You output ONLY strict JSON." },
        { role: "user", content: gptPrompt },
      ],
      temperature: 0.4,
    });

    let raw = completion.choices[0].message.content;
    raw = raw.replace(/```json|```/g, "").trim();

    let itinerary;
    try {
      itinerary = JSON.parse(raw);
    } catch {
      itinerary = {};
    }

    itinerary = normalizeItinerary(itinerary);

    // Validate with Google Places
    itinerary.days = await validateAndFixActivities(
      itinerary.days,
      process.env.GOOGLE_PLACES_API_KEY,
      weather
    );

    // If no valid activities → fallback Darwin
    if (itinerary.days[0].activities.length === 0) {
      itinerary = buildFallbackDarwin();
    }

    return NextResponse.json(
      { ok: true, itinerary, weather, userLocation },
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Itinerary generation failed",
        details: String(err),
      },
      { status: 500 }
    );
  }
}
