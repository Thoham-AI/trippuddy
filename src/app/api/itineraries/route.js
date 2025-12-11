"use server";
// =======================================
// TripPuddy — Smart Backend v5 (Stable)
// =======================================

import { NextResponse } from "next/server";
import OpenAI from "openai";

// ----------------------------------------------
// GPT CLIENT
// ----------------------------------------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----------------------------------------------
// OPENWEATHER
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
// GOOGLE PLACES
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
// GOOGLE PHOTO
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
// GPT PROMPT — IMPROVED
// ----------------------------------------------
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

// ----------------------------------------------
// NORMALIZE ITINERARY — MULTI-DAY SAFE
// ----------------------------------------------
function normalizeItinerary(raw) {
  if (!raw || !raw.days) return { days: [] };

  if (!Array.isArray(raw.days)) return { days: [] };

  return raw;
}

// ----------------------------------------------
// FIX START TIMES (FIRST ACTIVITY)
// ----------------------------------------------
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

// ----------------------------------------------
// VALIDATE + FIX ACTIVITIES — NON-DESTRUCTIVE
// ----------------------------------------------
async function validateAndFixActivities(days, apiKey, weather) {
  const month = new Date().getMonth() + 1;
  const wetSeason = month >= 11 || month <= 4;
  const heavyRain =
    weather?.weather?.[0]?.main?.toLowerCase()?.includes("rain") ?? false;

  const weatherLink = weather
    ? `https://openweathermap.org/weathermap?basemap=map&layers=temperature&lat=${weather.coord.lat}&lon=${weather.coord.lon}&zoom=10`
    : null;

  for (const day of days) {
    const fixed = [];

    for (const a of day.activities) {
      const query = a.google_maps_query || a.title;
      const place = await fetchPlaceDetails(query, apiKey);

      // 🔥 DO NOT REMOVE ACTIVITY — fallback instead
      if (!place) {
        fixed.push({
          ...a,
          title: a.title || query,
          image: null,
          latitude: null,
          longitude: null,
          google_maps_query: query,
          weather: weather
            ? {
                temp: weather?.main?.temp ?? null,
                description: weather?.weather?.[0]?.description ?? null,
                icon: weather?.weather?.[0]?.icon ?? null,
                link: weatherLink,
              }
            : null,
        });
        continue;
      }

      // Weather avoidance logic preserved
      if (wetSeason && /mindil/i.test(place.name)) continue;
      if (
        heavyRain &&
        /beach|lookout|reserve|trail|national|cliff|coast/i.test(place.name)
      )
        continue;

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
              temp: weather?.main?.temp ?? null,
              description: weather?.weather?.[0]?.description ?? null,
              icon: weather?.weather?.[0]?.icon ?? null,
              link: weatherLink,
            }
          : null,
      });
    }

    // Ensure each day has at least 1 activity
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
        estimated_cost: "Free",
      });
    }

    day.activities = fixed;
  }

  return days;
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
      userLocation = { lat: -12.4634, lon: 130.8456 };
    }

    const weather = await getWeather(userLocation.lat, userLocation.lon);

    // Build GPT prompt
    const gptPrompt = buildGPTPrompt(userPrompt, weather);

    // GPT CALL
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY valid JSON. Never markdown." },
        { role: "user", content: gptPrompt },
      ],
      temperature: 0.5,
      max_tokens: 6000,
    });

    let raw = completion.choices[0].message.content;
    raw = raw.replace(/```json|```/g, "").trim();

    let itinerary;
    try {
      itinerary = JSON.parse(raw);
    } catch {
      itinerary = { days: [] };
    }

    itinerary = normalizeItinerary(itinerary);

    // Fix morning start
    itinerary.days = ensureMorningStart(itinerary.days);

    // Validate and fix activities
    itinerary.days = await validateAndFixActivities(
      itinerary.days,
      process.env.GOOGLE_PLACES_API_KEY,
      weather
    );

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
