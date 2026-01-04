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

/**
 * Lightweight language guess (no OpenAI call).
 * Extend as needed.
 */
function guessLang(text) {
  const s = String(text || "");

  // Vietnamese (common diacritics)
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(s)) {
    return "vi";
  }

  // Japanese
  if (/[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9faf]/.test(s)) {
    return "ja";
  }

  // Korean
  if (/[\uac00-\ud7af]/.test(s)) {
    return "ko";
  }

  // Thai
  if (/[\u0E00-\u0E7F]/.test(s)) {
    return "th";
  }

  // Arabic
  if (/[\u0600-\u06FF]/.test(s)) {
    return "ar";
  }

  return "en";
}

function systemPrompt(lang, userTitle) {
  const title = String(userTitle || "Boss").trim() || "Boss";
  return `
You are TripPuddy — a multilingual travel assistant.

Rules:
- Always respond in ${lang}.
- Address the user as "${title}" naturally in your reply (e.g., "Hi ${title}, ...", "Sure thing, ${title}.").
- Be concise, friendly, and helpful about travel.
- If the user asks for nearby suggestions, ask for city/suburb if missing.
`.trim();
}

function friendly429Message() {
  return (
    "⚠️ I’m receiving too many requests right now. Please wait a moment and try again.\n\n" +
    "If this keeps happening, reduce rapid clicks or upgrade your API rate limits in OpenAI billing/rate limit settings."
  );
}

function friendlyQuotaMessage() {
  return (
    "⚠️ The AI service is out of quota for this API key right now.\n\n" +
    "Please check your OpenAI billing/quota, then try again."
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Optional preference (Boss/Honey/etc)
    const userTitle = body.userTitle ?? body.title ?? "Boss";

    // ✅ No OpenAI call here — keeps RPM low
    const lang = guessLang(lastMessage);

    const openai = getClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt(lang, userTitle) }, ...messages],
      max_tokens: 500,
      temperature: 0.5,
    });

    const reply = completion.choices[0]?.message?.content || "";
    return NextResponse.json({ reply, language: lang });
  } catch (err) {
    // Handle known OpenAI errors without breaking UI
    const status = err?.status || err?.response?.status;
    const code = err?.code || err?.error?.code;

    console.error("CHAT ROUTE ERROR:", err);

    // Rate limit
    if (status === 429 && code === "rate_limit_exceeded") {
      return NextResponse.json({ reply: friendly429Message(), language: "en" }, { status: 200 });
    }

    // Insufficient quota
    if (status === 429 && code === "insufficient_quota") {
      return NextResponse.json({ reply: friendlyQuotaMessage(), language: "en" }, { status: 200 });
    }

    return NextResponse.json({ reply: "⚠️ Error in /api/chat", language: "en" }, { status: 200 });
  }
}
