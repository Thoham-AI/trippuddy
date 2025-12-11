import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { activity, location } = await req.json();

    const prompt = `
User is visiting: ${activity.title}
Location: ${location?.name || ""}, ${location?.country || ""}

Suggest 3–5 alternative places nearby that match the same mood or purpose.
For each alternative, give:
- Name
- 1-sentence description
- Why it's a good alternative
Return in bullet points.`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a local travel expert." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const text = res.choices[0].message.content || "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("alternatives error", err);
    return NextResponse.json({ text: "Error getting alternatives." }, { status: 500 });
  }
}
