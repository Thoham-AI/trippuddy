// src/app/api/alternatives/handler.node.js
import OpenAI from "openai";

export default async function handleAlternatives(input) {
  try {
    const { activity, location } = input || {};

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
User is visiting: ${activity?.title || ""}
Location: ${location?.name || ""}, ${location?.country || ""}

Suggest 3–5 alternative places nearby that match the same mood or purpose.
For each alternative, give:
- Name
- 1-sentence description
- Why it's a good alternative
Return only bullet points.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a local travel expert." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    return { text: res.choices[0]?.message?.content || "" };
  } catch (err) {
    console.error("ALTERNATIVES HANDLER ERROR:", err);
    return { text: "Error generating alternatives." };
  }
}
