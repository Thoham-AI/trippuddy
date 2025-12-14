// src/app/api/food/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const activity = body.activity || { title: "" };
    const location = body.location || {};

    const prompt = `
User is near: ${activity.title}
Area: ${location?.name || ""}, ${location?.country || ""}

Recommend 5 places to eat nearby.
Include:
- cheap local food
- mid-range
- one nicer option

For each: name, cuisine, price $, and what to order.
Return ONLY bullet points.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a foodie local guide." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const text = res.choices[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("FOOD ROUTE ERROR:", err);
    return NextResponse.json(
      { text: "Error getting food suggestions." },
      { status: 500 }
    );
  }
}
