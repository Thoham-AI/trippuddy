// src/app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// FORCE NODE RUNTIME — required to avoid Edge crashes
export const runtime = "nodejs";

/**
 * Detect language using the OpenAI API.
 * Must run inside the request handler for proper runtime isolation.
 */
async function detectLanguage(client: OpenAI, text: string): Promise<string> {
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

/**
 * Build system prompt
 */
function systemPrompt(lang: string) {
  return `
You are TripPuddy — a multilingual travel assistant.

GENERAL RULES:
1. ALWAYS reply in the user's language: ${lang}.
2. Keep responses natural, concise, friendly.
3. DO NOT hallucinate places. If unsure → ask politely.
4. DO NOT misinterpret greetings (bonjour, xin chào, hola, etc.)
5. If a greeting is misspelled, treat it as a greeting first.
6. Only interpret a message as a location if:
   - It matches a real place, AND
   - The user intent is about travel/location.

LANGUAGE BEHAVIOR:
7. NEVER switch languages unless the user switches.
8. Respond fluently in ${lang}.

CLARIFICATION:
9. If unsure whether the user meant a place or a phrase:
   Ask ONE polite clarification question in the user's language.
`;
}

/**
 * Chat Route Handler — fully Node runtime compatible
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Instantiate OpenAI INSIDE handler — prevents RSC/Edge binding
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Detect user language
    const lang = await detectLanguage(client, lastMessage);

    // Chat completion
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(lang) },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const reply = completion.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("CHAT API ERROR:", err);
    return NextResponse.json(
      { reply: "⚠️ Error in /api/chat" },
      { status: 500 }
    );
  }
}
