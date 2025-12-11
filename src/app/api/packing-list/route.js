import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { itinerary } = await req.json();

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are TripPuddy, an expert travel assistant. Given an itinerary JSON, produce a concise packing list in bullet points. Group by category (Clothing, Toiletries, Documents, Electronics, Other). Output plain text, no JSON.",
        },
        {
          role: "user",
          content: JSON.stringify(itinerary),
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const text = res.choices[0].message.content || "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("packing-list error", err);
    return NextResponse.json({ text: "Error generating packing list." }, { status: 500 });
  }
}
