// src/app/api/tourguide/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();

    const prompt = `
You are a friendly, knowledgeable local tour guide.
Given this itinerary or location info, write a short narrative a human guide might say.

DATA:
${JSON.stringify(body, null, 2)}
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a fun, insightful local tour guide.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 600,
    });

    const text = res.choices[0]?.message?.content || "";

    return NextResponse.json({ ok: true, text });
  } catch (err) {
    console.error("TOURGUIDE ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Tour guide generation failed." },
      { status: 500 }
    );
  }
}
