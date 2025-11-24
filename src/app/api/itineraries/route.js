// src/app/api/itineraries/route.js
import { NextResponse } from "next/server";
import { getNearbyPlaces } from "@/lib/places";
import { getCurrentWeather } from "@/lib/weather";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      location,
      startTime = "08:00",
      durationHours = 4,
      budgetLevel = "low",
      vibe = "chill",
      mealType = "breakfast",
    } = body || {};

    if (!location || typeof location.lat !== "number" || typeof location.lon !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid location" },
        { status: 400 }
      );
    }

    const lat = location.lat;
    const lon = location.lon;

    // 1) Real-world data
    const wantBreakfast = mealType === "breakfast" || mealType === "any";

    const cafes = wantBreakfast
      ? await getNearbyPlaces({
          lat,
          lon,
          radiusMeters: 2500,
          type: "cafe",
          openNow: true,
        })
      : [];

    const restaurants =
      mealType !== "breakfast"
        ? await getNearbyPlaces({
            lat,
            lon,
            radiusMeters: 2500,
            type: "restaurant",
            openNow: true,
          })
        : [];

    const attractions = await getNearbyPlaces({
      lat,
      lon,
      radiusMeters: 4000,
      type: "tourist_attraction",
      openNow: true,
    });

    const weather = await getCurrentWeather(lat, lon);

    const facts = {
      coords: { lat, lon },
      startTime,
      durationHours,
      budgetLevel,
      vibe,
      mealType,
      weather,
      cafes,
      restaurants,
      attractions,
    };

    // 2) AI itinerary based on these facts
    const aiResult = await generateItineraryWithAI(facts);
    const slots = aiResult?.slots || [];

    // 3) Enrich slots with coordinates, location, weather, images, links
    const activities = enrichSlots(slots, facts);

    const itinerary = [
      {
        day: 1,
        activities,
      },
    ];

    return NextResponse.json({ itinerary });
  } catch (err) {
    console.error("itinerary error:", err);
    return NextResponse.json(
      { error: "Failed to generate itinerary" },
      { status: 500 }
    );
  }
}

/* ---------- Match AI slots to real Google places ---------- */

function enrichSlots(slots, facts) {
  const { cafes = [], restaurants = [], attractions = [], weather } = facts;

  const allPlaces = [
    ...cafes.map((p) => ({ ...p, sourceType: "cafe" })),
    ...restaurants.map((p) => ({ ...p, sourceType: "restaurant" })),
    ...attractions.map((p) => ({ ...p, sourceType: "attraction" })),
  ];

  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  return slots.map((slot) => {
    const title = slot.placeName || slot.title || "";
    const key = norm(title);

    let best = null;
    let bestScore = 0;

    for (const p of allPlaces) {
      const k2 = norm(p.name);
      if (!k2) continue;
      if (k2 === key) {
        best = p;
        bestScore = 1;
        break;
      }
      if (k2.includes(key) || key.includes(k2)) {
        if (bestScore < 0.8) {
          best = p;
          bestScore = 0.8;
        }
      }
    }

    const coords =
      best && best.lat && best.lon
        ? { lat: best.lat, lon: best.lon }
        : null;

    const location = {
      name: best?.name || title,
      city: best?.address || "",
      country: "", // optional; your flag() will just show nothing if empty
    };

    const image = best?.photoUrl || null;

    const link = best?.placeId
      ? `https://www.google.com/maps/search/?api=1&query_place_id=${best.placeId}`
      : null;

    const weatherObj = weather
      ? {
          temp: Math.round(weather.tempC),
          description: weather.description,
          link: weather.link,
        }
      : null;

    return {
      time: slot.time || "Flexible",
      title: title || "Activity",
      details: slot.description || "",
      cost_estimate: slot.approxCostAUD
        ? `Approx ${slot.approxCostAUD} AUD`
        : "",
      coordinates: coords,
      location,
      image,
      link,
      weather: weatherObj,
      travelTime: null,
    };
  });
}

/* ---------- AI call using OpenAI Chat Completions ---------- */

async function generateItineraryWithAI(facts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: simple stub so the app does not crash
    const cafes = facts.cafes || [];
    const first = cafes[0];
    return {
      slots: [
        {
          time: facts.startTime || "08:00–09:00",
          placeName: first?.name || "Nearby café",
          description:
            "Your OpenAI key is missing. This is a simple placeholder itinerary.",
          approxCostAUD: 15,
        },
      ],
    };
  }

  const system = `
You are TripPuddy, a local-savvy travel planner.
You MUST ONLY use the places provided in the JSON facts.
For each slot, pick one place from cafes/restaurants/attractions.
Return JSON with:
{
  "slots": [
    {
      "time": "08:00–09:00",
      "placeName": "...",   // EXACTLY one of the given place names
      "title": "...",       // optional display title
      "description": "...",
      "approxCostAUD": 10
    }
  ]
}
Do NOT invent new places or fake opening hours.
Respect the weather: if heavy rain, avoid outdoor beaches and markets.
`;

  const user = `
User request and real-world facts (JSON):

${JSON.stringify(facts, null, 2)}
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    console.error("OpenAI error:", await res.text());
    throw new Error("OpenAI failed");
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to parse AI JSON:", err, content);
    return { slots: [] };
  }
}
