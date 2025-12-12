import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const body = await req.json();

    // Support multiple input formats
    const activity = body.activity || { title: body.userPrompt || "" };
    const location = body.location || body.userLocation || {};

    const prompt = `
User is near: ${activity.title}
Area: ${location?.name || ""}, ${location?.country || ""}

Recommend 5 places to eat nearby.
Include a mix of:
- cheap local food
- mid-range
- one nicer option if appropriate

For each place, give:
- Name
- Type of cuisine
- Rough price level ($, $$, $$$)
- 1 short tip (what to order)

Return in bullet points.
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

    const text = res.choices[0].message.content || "";
    return NextResponse.json({ text });

  } catch (err) {
    console.error("food error", err);
    return NextResponse.json(
      { text: "Error getting food suggestions." },
      { status: 500 }
    );
  }
}
