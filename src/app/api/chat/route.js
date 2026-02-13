// src/app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

let client;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function POST(req) {
  try {
    const { messages, userTitle } = await req.json();
    const openai = getClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are TripPuddy. Address user as ${userTitle || "Boss"}.
          ALWAYS respond with JSON:
          {
            "reply": "your text",
            "destinations": [
              { "name": "Place", "image": "https://loremflickr.com/640/480/travel,cityname", "description": "text" }
            ]
          }`
        },
        ...messages
      ],
      response_format: { type: "json_object" }
    });

    return NextResponse.json(JSON.parse(completion.choices[0].message.content));
  } catch (error) {
    return NextResponse.json({ reply: "Error", destinations: [] });
  }
}