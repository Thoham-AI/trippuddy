// ===============================
// FULLY FIXED BACKEND — route.js
// ===============================

import { NextResponse } from "next/server";
import OpenAI from "openai";

// ----------------------------------------------
// GPT CLIENT
// ----------------------------------------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----------------------------------------------
// WEATHER
// ----------------------------------------------
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

// ----------------------------------------------
// GOOGLE PLACES (TEXT SEARCH + DETAILS)
// ----------------------------------------------
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

    // FIX: include photos so activity.image exists
    const detailURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry,opening_hours,photos,types,formatted_address,url&key=${apiKey}`;

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
      url: r.url || null,
      place_id: placeId,
    };
  } catch (err) {
    console.error("fetchPlaceDetails error:", err);
    return null;
  }
}

// ----------------------------------------------
// GOOGLE PHOTO URL
// ----------------------------------------------
function makePhotoURL(photoRef, apiKey) {
  if (!photoRef) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=${photoRef}&key=${apiKey}`;
}

// ----------------------------------------------
// UNSPLASH FALLBACK
// ----------------------------------------------
async function unsplashFallback(query) {
  const key = process.env.UNSPLASH_KEY;
  if (!key) return null;

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&client_id=${key}&orientation=landscape&per_page=1`;

    const res = await fetch(url);
    const json = await res.json();

    return json.results?.[0]?.urls?.regular || null;
  } catch {
    return null;
  }
}

// ----------------------------------------------
// UPGRADED GPT PROMPT
// ----------------------------------------------
function buildGPTPrompt(userPrompt, weather) {
  return `
You are an expert travel planner. Provide a **fully detailed realistic itinerary**.

RULES:
- Output ONLY valid JSON (no markdown).
- At least 4 rich activities per day.
- Each activity MUST include:
  • arrival_time  
  • duration_minutes  
  • suggested_departure_time  
  • distance_km_from_previous  
  • travel_time_minutes_from_previous  
  • description (4–6 sentences)  
  • category (food, culture, nature, adventure, relaxing, shopping, viewpoint)
  • google_maps_query (specific, unique place)

- Darwin wet season (Nov–Apr):
  • Mindil Sunset Market is closed.
  • Avoid sunset markets in the morning.
  • Avoid beaches/lookouts during heavy rain.

JSON FORMAT:
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

User request: "${userPrompt}"
Weather: ${JSON.stringify(weather)}
`;
}

// ----------------------------------------------
// NORMALIZE RAW GPT OUTPUT
// ----------------------------------------------
function normalizeItinerary(raw) {
  if (!raw) return { days: [{ day: 1, activities: [] }] };

  if (Array.isArray(raw.days)) return raw;

  if (Array.isArray(raw.activities))
    return { days: [{ day: 1, activities: raw.activities }] };

  if (raw.itinerary?.activities)
    return { days: [{ day: 1, activities: raw.itinerary.activities }] };

  return { days: [{ day: 1, activities: [] }] };
}

// ----------------------------------------------
// VALIDATE + FIX with REAL GOOGLE DATA
// ----------------------------------------------
async function validateAndFixActivities(days, apiKey, weather) {
  const month = new Date().getMonth() + 1;
  const wetSeason = month >= 11 || month <= 4;
  const heavyRain =
    weather?.weather?.[0]?.main?.toLowerCase()?.includes("rain") ?? false;

  for (const day of days) {
    const fixed = [];

    for (const a of day.activities) {
      const q = a.google_maps_query || a.title;

      const place = await fetchPlaceDetails(q, apiKey);
      if (!place) continue;

      if (wetSeason && /mindil/i.test(place.name)) continue;

      if (
        a.time_of_day?.toLowerCase()?.includes("morning") &&
        /sunset|market/i.test(place.name)
      )
        continue;

      if (
        heavyRain &&
        /beach|lookout|reserve|trail|national|cliff|coast/i.test(place.name)
      )
        continue;

      // IMAGE FIX: Google photo or Unsplash fallback
      const image =
 	 makePhotoURL(place.photo_reference, apiKey) ||
	  (await unsplashFallback(place.name)) ||
 	 null;

fixed.push({
  ...a,
  title: place.name,
  latitude: place.lat,
  longitude: place.lon,
  google_maps_query: place.name,
  image,

  // ⭐ ADD THIS WEATHER BLOCK ⭐
  weather: {
    temp: weather?.main?.temp ?? null,
    description: weather?.weather?.[0]?.description ?? null,
    icon: weather?.weather?.[0]?.icon ?? null,
    link: weather?.id ? `https://openweathermap.org/city/${weather.id}` : null,
  },
});
    }

    day.activities = fixed;
  }

  return days;
}

// ----------------------------------------------
// DARWIN FALLBACK (unchanged)
// ----------------------------------------------
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
              "Relax, swim or enjoy cafes by the waterfront."
          }
        ]
      }
    ]
  };
}

// ----------------------------------------------
// MAIN POST HANDLER
// ----------------------------------------------
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

    const gptPrompt = buildGPTPrompt(userPrompt, weather);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY VALID JSON." },
        { role: "user", content: gptPrompt }
      ],
      temperature: 0.95, // FIX: richer itineraries
    });

    let raw = completion.choices[0].message.content;
    raw = raw.replace(/```json|```/g, "").trim();

    let itinerary = {};
    try {
      itinerary = JSON.parse(raw);
    } catch {
      itinerary = {};
    }

    itinerary = normalizeItinerary(itinerary);

    itinerary.days = await validateAndFixActivities(
      itinerary.days,
      process.env.GOOGLE_PLACES_API_KEY,
      weather
    );

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
