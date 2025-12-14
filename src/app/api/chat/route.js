// src/app/api/chat/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function detectLanguage(text) {
  try {
    const detection = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Detect the language of the following text. Respond ONLY with a two-letter ISO language code. No explanation.",
        },
        { role: "user", content: text },
      ],
      max_tokens: 5,
    });

    return (
      detection.choices[0]?.message?.content?.trim()?.toLowerCase() || "en"
    );
  } catch {
    return "en";
  }
}

function systemPrompt(lang) {
  return `
You are TripPuddy — a multilingual travel assistant.
Always respond in ${lang}. Be concise, friendly, and helpful about travel.
`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const lastMessage = messages[messages.length - 1]?.content || "";

    const lang = await detectLanguage(lastMessage);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(lang) },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const reply = completion.choices[0]?.message?.content || "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("CHAT ROUTE ERROR:", err);
    return NextResponse.json(
      { reply: "⚠️ Error in /api/chat" },
      { status: 500 }
    );
  }
}
