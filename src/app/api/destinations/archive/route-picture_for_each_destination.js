// src/app/api/destinations/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Hàm gọi Unsplash API
async function fetchUnsplashImage(query) {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&client_id=${process.env.UNSPLASH_ACCESS_KEY}&orientation=landscape&per_page=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].urls.regular;
    }
  } catch (err) {
    console.error("Unsplash error:", err);
  }
  return "/fallback.jpg"; // fallback local
}

// Hàm gọi Nominatim để lấy lat/lon
async function fetchCoordinates(placeName, city = "") {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      placeName + " " + city
    )}`;
    const res = await fetch(url, { headers: { "User-Agent": "travel-ai-app" } });
    const data = await res.json();
    if (data.length > 0) {
      return {
        lat: data[0].lat,
        lon: data[0].lon,
        display_name: data[0].display_name,
      };
    }
  } catch (err) {
    console.error("Nominatim error:", err);
  }
  return null;
}

// Hàm gọi Overpass để lấy giờ mở cửa (nếu có)
async function fetchOpeningHours(lat, lon) {
  try {
    const query = `
      [out:json];
      node(around:200,${lat},${lon})[opening_hours];
      out 1;
    `;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    const json = await res.json();
    if (json.elements && json.elements.length > 0) {
      return json.elements[0].tags.opening_hours || null;
    }
  } catch (err) {
    console.error("Overpass error:", err);
  }
  return null;
}

export async function POST(req) {
  try {
    const { prompt } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // --- Step 1: Gọi OpenAI ---
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional travel planner AI.
Always respond ONLY with valid JSON in this schema:

{
  "destinations": [
    { "name": "string", "country": "string", "description": "string", "image": "string" }
  ],
  "itinerary": [
    {
      "day": number,
      "date": "string (Day 1, Day 2, ...)",
      "activities": [
        {
          "time": "string (e.g. 09:00 - 11:00)",
          "title": "string (activity name)",
          "location": "string (place name)",
          "details": "string (short description, what to expect, tips)",
          "cost_estimate": "string (approx price in USD or local currency)",
          "link": "string (Google Maps or official website if available)",
          "image": "string"
        }
      ]
    }
  ]
}
Rules:
- 3–6 activities per day with clear time slots.
- Include food or cultural experiences as activities.
- Use internationally recognized names in English.
- Do not include explanations outside JSON.
`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    // --- Step 2: Parse JSON từ OpenAI ---
    const rawText = response.choices[0].message.content.trim();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON parse error:", rawText);
      return NextResponse.json(
        { error: "AI response is not valid JSON" },
        { status: 500 }
      );
    }

    // --- Step 3: Enrich với dữ liệu OSM + Unsplash ---
    for (const day of data.itinerary) {
      for (const act of day.activities) {
        const coords = await fetchCoordinates(act.location);
        if (coords) {
          act.coordinates = coords;

          const hours = await fetchOpeningHours(coords.lat, coords.lon);
          if (hours) {
            act.opening_hours = hours;
            act.details += ` | Opening hours: ${hours}`;
          }
        }

        act.image = await fetchUnsplashImage(act.location);
      }
    }

    for (const dest of data.destinations) {
      dest.image = await fetchUnsplashImage(dest.name + " " + dest.country);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Failed to generate itinerary" },
      { status: 500 }
    );
  }
}
