// src/app/api/chat/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

// Lazy client creation — SAFE for Vercel
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

function sanitizeLang(code) {
  const c = String(code || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 2);
  return /^[a-z]{2}$/.test(c) ? c : "en";
}

async function detectLanguage(text) {
  try {
    const openai = getClient();

    const detection = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Detect the language of the following text. Respond ONLY with a two-letter ISO language code (e.g., en, vi, ja). No explanation.",
        },
        { role: "user", content: text || "" },
      ],
      max_tokens: 5,
      temperature: 0,
    });

    const raw = detection.choices[0]?.message?.content?.trim() || "en";
    return sanitizeLang(raw);
  } catch {
    return "en";
  }
}

function systemPrompt(lang, userTitle) {
  const title = String(userTitle || "Boss").trim() || "Boss";
  return `
You are TripPuddy — a multilingual travel assistant.

Rules:
- Always respond in ${lang}.
- Address the user as "${title}" naturally in your reply (e.g., "Hi ${title}, ...", "Sure thing, ${title}.").
- Be concise, friendly, and helpful about travel.
- If the user uses multiple languages, respond in the dominant one (${lang}).
`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const lastMessage = messages[messages.length - 1]?.content || "";

    // ✅ NEW: caller preference (Boss/Honey/etc)
    const userTitle = body.userTitle ?? body.title ?? "Boss";

    const lang = await detectLanguage(lastMessage);

    const openai = getClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(lang, userTitle) },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const reply = completion.choices[0]?.message?.content || "";

    // ✅ NEW: include language (non-breaking for existing clients)
    return NextResponse.json({ reply, language: lang });
  } catch (err) {
    console.error("CHAT ROUTE ERROR:", err);
    return NextResponse.json(
      { reply: "⚠️ Error in /api/chat" },
      { status: 500 }
    );
  }
}
