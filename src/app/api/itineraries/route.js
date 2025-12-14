// src/app/api/itineraries/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

function buildPrompt(userPrompt, userLocation) {
  return `
You are TripPuddy — an expert AI travel planner.

User prompt: "${userPrompt}"
Approx user location: ${JSON.stringify(userLocation || {}, null, 2)}

Generate a realistic travel itinerary.

RULES:
- Detect number of days from the prompt
- Output EXACTLY that many days
- 4–7 activities per day
- First activity starts in the morning
- Return STRICT JSON only
`;
}

function normalizeItinerary(raw) {
  if (!raw || !Array.isArray(raw.days)) return { days: [] };
  return {
    days: raw.days.map((d, i) => ({
      day: d.day ?? i + 1,
      activities: Array.isArray(d.activities) ? d.activities : [],
    })),
  };
}

function ensureMorningStart(days) {
  for (const day of days) {
    if (!day.activities?.length) continue;
    const a = day.activities[0];
    a.time_of_day ||= "Morning";
    a.arrival_time ||= "09:00";
    a.suggested_departure_time ||= "10:30";
    a.duration_minutes ||= 90;
  }
  return days;
}

export async function POST(req) {
  try {
    const { userPrompt, userLocation } = await req.json();

    if (!userPrompt?.trim()) {
      return NextResponse.json(
        { ok: false, error: "userPrompt is required" },
        { status: 400 }
      );
    }

    // ✅ Create OpenAI client ONLY at request time
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY valid JSON." },
        { role: "user", content: buildPrompt(userPrompt, userLocation) },
      ],
      temperature: 0.5,
      max_tokens: 6000,
    });

    let text = completion.choices[0]?.message?.content || "";
    text = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
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
    console.error("ITINERARIES ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "Itinerary generation failed" },
      { status: 500 }
    );
  }
}
