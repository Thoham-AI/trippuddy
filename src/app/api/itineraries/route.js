import { NextResponse } from "next/server";

// Load OpenAI Edge client (new API)
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper: fetch weather
async function getWeather(lat, lon) {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return null;

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error("Weather error:", err);
    return null;
  }
}

// Helper: Generate one image for the place
async function generateImage(prompt) {
  try {
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: `Travel destination photo: ${prompt}`,
      size: "1024x1024",
    });

    return result.data[0].url;
  } catch (err) {
    console.error("Image generation error:", err);
    return null;
  }
}

export async function POST(req) {
  console.log("---- API HIT ----");

  try {
    const bodyText = await req.text();
    const data = JSON.parse(bodyText || "{}");

    console.log("Parsed Body:", data);

    const userPrompt = data.userPrompt || "1 day itinerary";
    const userLocation = data.userLocation || null;

    // Weather if we have coordinates
    let weather = null;
    if (userLocation?.lat && userLocation?.lon) {
      weather = await getWeather(userLocation.lat, userLocation.lon);
    }

    // Ask GPT-4.1 for itinerary
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert travel planner. Output JSON only.",
        },
        {
          role: "user",
          content: `
Generate a detailed JSON itinerary for: "${userPrompt}".

Include for each activity:
- time of day
- title
- description
- estimated cost
- Google Maps search query
- latitude & longitude (guess if needed)

User weather: ${weather ? JSON.stringify(weather) : "unknown"}
        `,
        },
      ],
      temperature: 0.4,
    });

    let itineraryJSON = completion.choices[0].message.content || "{}";

    let itinerary;
    try {
      itinerary = JSON.parse(itineraryJSON);
    } catch {
      // Fix possibly wrapped code blocks
      itinerary = JSON.parse(
        itineraryJSON.replace(/```json|```/g, "").trim()
      );
    }

    // Add images to each activity
    for (const day of itinerary.days || []) {
      for (const act of day.activities || []) {
        act.image = await generateImage(act.title);
      }
    }

// 🔍 DEBUG: print the entire itinerary structure
console.log("FULL API RESPONSE:", JSON.stringify({ itinerary, weather, userLocation }, null, 2));

    return NextResponse.json(
      {
        ok: true,
        itinerary,
        weather,
        userLocation,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Itinerary generation failed",
        details: String(err),
      },
      { status: 500 }
    );
  }
}
