// src/app/api/food/route.js

const { NextResponse } = require("next/server");
const OpenAI = require("openai");

// Force Node.js runtime (OpenAI SDK cannot run on Edge)
export const runtime = "nodejs";

// CommonJS-safe POST export
module.exports.POST = async function (req) {
  try {
    const body = await req.json();
    const activity = body.activity || { title: "" };
    const location = body.location || {};

    // Create OpenAI client inside handler (prevents RSC binding)
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
User is near: ${activity.title}
Area: ${location?.name || ""}, ${location?.country || ""}

Recommend 5 places to eat nearby.
Include:
- cheap local food
- mid-range
- one nicer option

For each: name, cuisine, price $, tip (what to order).
Return bullet points only.
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a foodie local guide." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const text = res.choices[0].message.content ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("food error", err);
    return NextResponse.json(
      { text: "Error getting food suggestions." },
      { status: 500 }
    );
  }
};
