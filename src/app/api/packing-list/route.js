// src/app/api/packing-list/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const itinerary = body.itinerary;

    if (!itinerary || typeof itinerary !== "object") {
      return NextResponse.json(
        { ok: false, text: "Missing or invalid itinerary." },
        { status: 400 }
      );
    }

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are TripPuddy, an expert travel assistant.
Given an itinerary JSON, produce a concise packing list in bullet points.
Group items into: Clothing, Toiletries, Documents, Electronics, Other.
Output human-friendly plain text only. Do NOT output JSON.`,
        },
        {
          role: "user",
          content: JSON.stringify(itinerary),
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const text = res.choices[0]?.message?.content || "";

    return NextResponse.json({ ok: true, text });
  } catch (err) {
    console.error("PACKING-LIST ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Packing list generation failed." },
      { status: 500 }
    );
  }
}
