// src/app/api/chat/handler.node.js
import OpenAI from "openai";

async function detectLanguage(client, text) {
  try {
    const detection = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Detect the two-letter language code." },
        { role: "user", content: text },
      ],
      max_tokens: 5,
    });

    return detection.choices[0]?.message?.content?.trim()?.toLowerCase() || "en";
  } catch {
    return "en";
  }
}

function systemPrompt(lang) {
  return `
You are TripPuddy — a multilingual travel assistant.
Always answer in ${lang}. Keep answers friendly and natural.
`;
}

export default async function handleChat(input) {
  try {
    const messages = input?.messages || [];
    const last = messages[messages.length - 1]?.content || "";

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const lang = await detectLanguage(client, last);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(lang) },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    return { reply: response.choices[0]?.message?.content || "" };
  } catch (err) {
    console.error("CHAT HANDLER ERROR:", err);
    return { reply: "⚠️ Error processing chat." };
  }
}
