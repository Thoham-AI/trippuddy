export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

async function fetchUnsplash(query) {
  try {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) return null;

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&client_id=${key}&per_page=1&orientation=landscape`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
You are TripPuddy, an expert travel planner.
Return STRICT JSON.
Rules:
- detect number of days
- 4–6 activities/day
- include times
- do NOT include image URLs
- leave "image": "" for each activity

Format:
{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "title": "",
          "arrival_time": "",
          "duration_minutes": 60,
          "description": "",
          "latitude": 0,
          "longitude": 0,
          "image": ""
        }
      ]
    }
  ]
}

USER REQUEST:
${body.userPrompt}
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    let raw = res.choices[0]?.message?.content || "";
    raw = raw.replace(/```json|```/g, "").trim();

    let itinerary;
    try {
      itinerary = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse failed:", raw);
      return NextResponse.json(
        { ok: false, error: "Invalid itinerary format" },
        { status: 500 }
      );
    }

    // FIX: attach real working images
    for (const day of itinerary.days ?? []) {
      for (const act of day.activities ?? []) {
        if (!act.title) continue;
        const img = await fetchUnsplash(`${act.title} travel`);
        if (img) act.image = img;
      }
    }

    return NextResponse.json({
      ok: true,
      itinerary,
    });
  } catch (err) {
    console.error("ITINERARIES ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "Itinerary generation failed" },
      { status: 500 }
    );
  }
}
