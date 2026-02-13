// src/app/api/chat/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { messages, userTitle, likedPlaces = [], dislikedPlaces = [], isFinalizing = false } = await req.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const name = userTitle || "Boss";

    let systemContent = `You are TripPuddy, a professional travel planner. Address the user as "${name}". Return ONLY JSON.`;

    if (isFinalizing) {
      const likedNames = likedPlaces.map(p => p.name).join(", ");
      const dislikedNames = dislikedPlaces.map(p => p.name).join(", ");
      systemContent += `
      The user has selected these places: [${likedNames}]. 
      STRICTLY EXCLUDE these places: [${dislikedNames}].
      Task: Create a detailed day-by-day itinerary. 
      Structure the "reply" field with clear headings like "DAY 1: ...", "DAY 2: ...", use emojis and bullet points for activities. 
      Make it look like a professional travel brochure.`;
    } else {
      systemContent += `Suggest 3 spots. Use format: https://loremflickr.com/640/480/travel,{place_name}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemContent }, ...messages],
      response_format: { type: "json_object" }
    });

    return NextResponse.json(JSON.parse(completion.choices[0].message.content));
  } catch (error) {
    return NextResponse.json({ reply: "Error!" });
  }
}