// src/app/api/itineraries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPrompt(userPrompt, userLocation) {
  return `
You are TripPuddy — an expert AI travel planner.

User prompt: "${userPrompt}"
Approx user location: ${JSON.stringify(userLocation || {}, null, 2)}

Generate a realistic travel itinerary.

RULES:
- Detect number of days from the prompt (e.g. "1 day Hanoi", "7 days Darwin").
- Output EXACTLY that many days.
- 4–7 activities per day.
- First activity each day starts in the morning (08:00–09:30).
- For each activity, give realistic times, description, and coordinates near the real place.

STRICT JSON OUTPUT ONLY in this format:

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
`;
}

function normalizeItinerary(raw) {
  if (!raw || !Array.isArray(raw.days)) return { days: [] };
  return {
    days: raw.days.map((d, idx) => ({
      day: d.day ?? idx + 1,
      activities: Array.isArray(d.activities) ? d.activities : [],
    })),
  };
}

function ensureMorningStart(days) {
  for (const day of days) {
    if (!day.activities?.length) continue;
    const first = day.activities[0];
    first.time_of_day = first.time_of_day || "Morning";
    first.arrival_time = first.arrival_time || "09:00";
    first.suggested_departure_time =
      first.suggested_departure_time || "10:30";
    first.duration_minutes = first.duration_minutes || 90;
  }
  return days;
}

export async function POST(req) {
  try {
    const body = await req.json();
    let { userPrompt, userLocation } = body || {};

    if (typeof userPrompt !== "string" || !userPrompt.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "userPrompt is required and must be a non-empty string.",
        },
        { status: 400 }
      );
    }
    userPrompt = userPrompt.trim();

    const prompt = buildPrompt(userPrompt, userLocation);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY valid JSON. Never markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 6000,
    });

    let rawText = completion.choices[0]?.message?.content || "";
    rawText = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error("Failed to parse itinerary JSON:", err, rawText);
      parsed = { days: [] };
    }

    let itinerary = normalizeItinerary(parsed);
    itinerary.days = ensureMorningStart(itinerary.days);

    return NextResponse.json({
      ok: true,
      itinerary,
      userLocation: userLocation || null,
    });
  } catch (err) {
    console.error("ITINERARY ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "Itinerary generation failed." },
      { status: 500 }
    );
  }
}
