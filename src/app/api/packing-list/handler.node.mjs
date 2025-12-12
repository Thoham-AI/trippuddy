// src/app/api/packing-list/handler.node.mjs
// PURE NODE ESM — Not processed by Next.js RSC or Edge

import OpenAI from "openai";

// Lazy client loader for better error reporting
function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey: key });
}

export default async function handlePackingList(itinerary) {
  try {
    if (!itinerary || typeof itinerary !== "object") {
      return {
        ok: false,
        text: "Missing or invalid itinerary.",
      };
    }

    const client = getClient();

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are TripPuddy, an expert travel assistant.
Given an itinerary JSON, produce a concise packing list in bullet points.
Group items into: Clothing, Toiletries, Documents, Electronics, Other.
Output human-friendly plain text only. Do NOT output JSON.`,
        },
        {
          role: "user",
          content: JSON.stringify(itinerary),
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const text = res.choices[0]?.message?.content || "";

    return { ok: true, text };
  } catch (err) {
    console.error("PACKING-LIST handler error:", err);
    return {
      ok: false,
      text: "Packing list generation failed.",
      details: String(err),
    };
  }
}
