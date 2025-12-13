// src/app/api/food/handler.node.js
import OpenAI from "openai";

export default async function handleFood(input) {
  try {
    const { activity, location } = input || {};

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
User is near: ${activity?.title || ""}
Area: ${location?.name || ""}, ${location?.country || ""}

Recommend 5 places to eat nearby.
Include:
- cheap local food
- mid-range options
- one nicer option
For each: name, cuisine, price $, and what to order.
Return bullet points only.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a foodie local guide." },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.8,
    });

    return { text: res.choices[0]?.message?.content || "" };
  } catch (err) {
    console.error("FOOD HANDLER ERROR:", err);
    return { text: "Error generating food suggestions." };
  }
}
