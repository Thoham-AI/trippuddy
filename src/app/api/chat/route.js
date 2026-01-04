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

// Safe fetch (for reverse geocode)
async function safeFetch(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": process.env.OSM_USER_AGENT || "travel-ai-app",
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function reverseGeocodeCity(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return "";
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`;

  const res = await safeFetch(url, 8000);
  if (!res || !res.ok) return "";

  let data;
  try {
    data = await res.json();
  } catch {
    return "";
  }

  const addr = data?.address || {};
  return (
    addr.city ||
    addr.town ||
    addr.suburb ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    ""
  );
}

function systemPrompt(lang, userTitle, locationText) {
  const title = String(userTitle || "Boss").trim() || "Boss";

  return `
You are TripPuddy — a multilingual travel assistant.

Rules:
- Always respond in ${lang}.
- Address the user as "${title}" naturally (e.g., "Hi ${title}, ...", "Sure thing, ${title}.").
- Be concise, friendly, and helpful about travel.
- If the user asks for "near me", "nearby", "around here", cafes nearby, etc., use the user's provided location if available and DO NOT ask for their city again.
${locationText ? `- The user's current location context: ${locationText}` : ""}
`.trim();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const lastMessage = messages[messages.length - 1]?.content || "";

    // caller preference (Boss/Honey/etc)
    const userTitle = body.userTitle ?? body.title ?? "Boss";

    // location from client
    const loc = body.userLocation || {};
    const lat = loc?.lat;
    const lon = loc?.lon;
    const cityFromClient = (loc?.city || "").toString().trim();

    // Resolve city server-side if needed
    let city = cityFromClient;
    if (!city && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      city = await reverseGeocodeCity(lat, lon);
    }

    const locationText =
      Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
        ? `lat=${Number(lat).toFixed(5)}, lon=${Number(lon).toFixed(5)}${city ? ` (city: ${city})` : ""}`
        : (city ? `city: ${city}` : "");

    const lang = await detectLanguage(lastMessage);

    const openai = getClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(lang, userTitle, locationText) },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const reply = completion.choices[0]?.message?.content || "";

    return NextResponse.json({ reply, language: lang });
  } catch (err) {
    console.error("CHAT ROUTE ERROR:", err);

    // Graceful handling for rate/quota errors so UI doesn't look "broken"
    const msg = String(err?.message || "");
    const isRateLimit = msg.includes("Rate limit") || msg.includes("rate_limit");
    const isQuota = msg.includes("insufficient_quota") || msg.includes("exceeded your current quota");

    if (isRateLimit) {
      return NextResponse.json(
        { reply: "⚠️ I’m getting rate-limited right now. Please try again in a few seconds.", language: "en" },
        { status: 429 }
      );
    }
    if (isQuota) {
      return NextResponse.json(
        { reply: "⚠️ The server’s AI quota is exhausted. Please check billing / limits for the OpenAI API key.", language: "en" },
        { status: 402 }
      );
    }

    return NextResponse.json({ reply: "⚠️ Error in /api/chat" }, { status: 500 });
  }
}
