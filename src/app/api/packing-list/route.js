// src/app/api/packing-list/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

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

    // Create OpenAI client *inside* POST — never at top level
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are TripPuddy, an expert travel assistant.
Given an itinerary JSON, produce a concise packing list in bullet points.
Group items into: Clothing, Toiletries, Documents, Electronics, Other.
Output plain text only, NOT JSON.`,
        },
        { role: "user", content: JSON.stringify(itinerary) },
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    return NextResponse.json({
      ok: true,
      text: res.choices[0]?.message?.content || "",
    });
  } catch (err) {
    console.error("PACKING LIST ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Packing list generation failed." },
      { status: 500 }
    );
  }
}
