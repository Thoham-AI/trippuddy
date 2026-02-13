import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let client;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function POST(req) {
  try {
    const { messages, userTitle } = await req.json();
    const openai = getClient();

    // Đảm bảo tên luôn tồn tại
    const finalName = userTitle || "Boss";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are TripPuddy, a helpful travel guide.
          
          RULES:
          1. Address the user as "${finalName}" in every response.
          2. Return ONLY a valid JSON object.
          3. When suggesting places, ALWAYS provide 3 destinations.
          4. IMAGE URL format: https://loremflickr.com/640/480/travel,{city_name_keyword}
             (Important: Use specific keywords so images are different, e.g., "sydney-opera", "bondi-beach")
          
          JSON STRUCTURE:
          {
            "reply": "Text message to ${finalName}",
            "destinations": [
              {
                "name": "Name of place",
                "image": "https://loremflickr.com/640/480/travel,keyword",
                "description": "Short summary"
              }
            ]
          }`
        },
        ...messages
      ],
      response_format: { type: "json_object" }
    });

    const responseData = JSON.parse(completion.choices[0].message.content);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json({ reply: "Error!", destinations: [] }, { status: 500 });
  }
}