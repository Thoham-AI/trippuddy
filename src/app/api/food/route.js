// src/app/api/food/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

// Lazy OpenAI client — prevents build-time crashes
let client;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY missing");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

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
- mid-range options
- one nicer option

For each: name, cuisine, price $, what to order.
Output ONLY bullet points.
`;

    const openai = getClient();

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a foodie local guide." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    return NextResponse.json({
      text: res.choices[0]?.message?.content || "",
    });
  } catch (err) {
    console.error("FOOD ROUTE ERROR:", err);
    return NextResponse.json(
      { text: "Error getting food suggestions." },
      { status: 500 }
    );
  }
}
