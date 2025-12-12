// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";  // ✅ FIX: OpenAI SDK requires Node runtime

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Accurate language detection using OpenAI
 */
async function detectLanguage(text: string): Promise<string> {
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

  return detection.choices[0]?.message?.content?.trim()?.toLowerCase() || "en";
}

/**
 * Clean system prompt
 */
function systemPrompt(lang: string) {
  return `
You are TripPuddy — a multilingual travel assistant.

GENERAL RULES:
1. ALWAYS reply in the user's language: ${lang}.
2. Keep responses natural, concise, friendly.
3. DO NOT hallucinate places. If unsure → ask politely.
4. DO NOT misinterpret greetings (bonjour, xin chào, hola, etc.)
5. If the user greeting is ambiguous (bon jour spelled incorrectly), interpret it as a GREETING first.
6. Only interpret a message as a place if:
   - It matches a known place, AND
   - The user intent is about travel/location.

LANGUAGE BEHAVIOR:
7. NEVER switch languages unless the user switches.
8. Write naturally and fluently in ${lang}.

GREETING RULES:
9. If the message is a greeting (even if misspelled):
   - Respond naturally in the same language.
   - DO NOT try to make an itinerary.
   - DO NOT treat it as a location.

CLARIFICATION:
10. If unsure whether the user meant a place or a phrase:
    Ask ONE polite clarification question in the user's language.
`;
}

/**
 * Chat route handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lastMessage = body.messages?.[body.messages.length - 1]?.content || "";

    const lang = await detectLanguage(lastMessage);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(lang) },
        ...body.messages,
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    const reply = completion.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ reply: "⚠️ Error in /api/chat" });
  }
}
