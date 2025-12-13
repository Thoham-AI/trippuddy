// src/app/api/alternatives/route.js

const { NextResponse } = require("next/server");
const OpenAI = require("openai");

// ✅ Force this route to use Node.js runtime (not edge)
export const runtime = "nodejs";

// Lazily initialise the client so module evaluation is safer
let client;

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

// ✅ CommonJS-safe POST route export
module.exports.POST = async function (req) {
  try {
    const { activity, location } = await req.json();

    const prompt = `
User is visiting: ${activity?.title || ""}
Location: ${location?.name || ""}, ${location?.country || ""}

Suggest 3–5 alternative places nearby that match the same mood or purpose.
For each alternative, give:
- Name
- 1-sentence description
- Why it's a good alternative
Return in bullet points.
`;

    const openai = getClient();

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a local travel expert." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const text = res.choices[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("alternatives error", err);
    return NextResponse.json(
      { text: "Error getting alternatives." },
      { status: 500 }
    );
  }
};
