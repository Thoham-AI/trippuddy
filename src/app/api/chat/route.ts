import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types matching your frontend payload
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  messages?: ChatMessage[];
  userLocation?: {
    lat?: number | null;
    lon?: number | null;
    city?: string;
    country?: string;
  };
};

// Darwin CBD fallback if no location is provided
const FALLBACK_LOCATION = {
  lat: -12.4634,
  lon: 130.8456,
};

// ---------- WEATHER HELPER ----------

async function getWeather(lat: number, lon: number) {
  try {
    const apiKey = process.env.OPENWEATHER_KEY;
    if (!apiKey) {
      console.warn("⚠️ OPENWEATHER_KEY missing – skipping weather call");
      return null;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("⚠️ OpenWeather response not OK:", res.status);
      return null;
    }

    const data = await res.json();

    return {
      temp: Math.round(data.main?.temp ?? 0),
      description: data.weather?.[0]?.description ?? "",
      icon: data.weather?.[0]?.icon ?? "",
    };
  } catch (err) {
    console.warn("⚠️ Weather fetch failed:", err);
    return null;
  }
}

// ---------- SYSTEM PROMPT (SMART TRAVEL ASSISTANT v2) ----------

const BASE_SYSTEM_PROMPT = `
You are TripPuddy v2, a friendly, expert AI travel buddy.

Your job:
- Understand what the user *really* wants (food, cafés, bars, viewpoints, nature, museums, day plans, etc.).
- Give specific, useful, and realistic recommendations (not generic advice).
- Use the current weather and location context when it’s helpful.
- Be concise but warm. Use emojis where they add clarity (🌅🍜🚶‍♂️🏖️✨).
- When relevant, propose a short itinerary (1 day or a few hours) broken into morning / afternoon / evening or time blocks.

Behavior rules:
1. GREETINGS / VAGUE INPUT
   - If the user just says "hey", "hello", "hi", etc:
       • Give a friendly 1–2 sentence greeting.
       • Then ask a single clarifying question like:
         "What are you in the mood for today – cafés, food, sightseeing, or planning your day?"
   - Do NOT ask multiple questions at once.

2. NEARBY / PLACE SEARCH ("find a cafe nearby", "good dinner place", "rooftop bar")
   - Treat as a POI search request.
   - Suggest 3–5 specific places, each with:
       • name
       • rough area or neighbourhood if known
       • 1–2 sentence reason (vibe, view, food type, why it fits the query)
   - If it’s raining or the weather is poor, gently steer toward indoor-friendly options.
   - Mention if a place is better for:
       • laptops / working
       • romantic date
       • local vibe / street food
       • families
       • budget vs premium

3. ITINERARIES ("plan a 1-day trip", "2 days in Singapore", "afternoon itinerary")
   - Create a realistic, time-ordered plan.
   - Use time blocks or approximate times (e.g. "09:00–11:00 Gardens by the Bay").
   - Combine sightseeing, food, and brief rest moments.
   - Keep it achievable in one day; don't over-pack.

4. FOLLOW-UP SUGGESTIONS
   - End most answers with 2–3 bullet suggestions for next steps, such as:
       • "Want me to tweak this for a rainy day?"  
       • "Prefer more hidden-gem local spots?"  
       • "Want this as a step-by-step day plan?"

5. STYLE
   - Always respond in clear English.
   - Be positive, encouraging, and practical.
   - Do NOT talk about being an AI model or how you were trained.
`;

// ---------- ROUTE HANDLER ----------

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ Missing OPENAI_API_KEY");
      return NextResponse.json(
        {
          ok: false,
          error: "Server misconfigured: missing OpenAI API key",
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as RequestBody;
    const messages = body.messages ?? [];
    const userLocation = body.userLocation ?? {};

    // Decide which coordinates to use
    const lat =
      typeof userLocation.lat === "number" ? userLocation.lat : FALLBACK_LOCATION.lat;
    const lon =
      typeof userLocation.lon === "number" ? userLocation.lon : FALLBACK_LOCATION.lon;

    const weather = await getWeather(lat, lon);

    const locationSummary =
      userLocation.city || userLocation.country
        ? `${userLocation.city ?? ""}${userLocation.city && userLocation.country ? ", " : ""}${
            userLocation.country ?? ""
          }`
        : "Unknown city (Darwin fallback if in doubt)";

    const weatherSummary = weather
      ? `${weather.temp}°C, ${weather.description}`
      : "Weather data not available";

    // Build a short context system message with runtime info
    const runtimeContext = `
Current user context:
- Approx location: ${locationSummary}
- Coordinates used: lat ${lat}, lon ${lon}
- Weather: ${weatherSummary}
`.trim();

    // Prepare messages for OpenAI
    const openAiMessages = [
      {
        role: "system" as const,
        content: BASE_SYSTEM_PROMPT,
      },
      {
        role: "system" as const,
        content: runtimeContext,
      },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAiMessages,
      temperature: 0.8,
      max_tokens: 800,
    });

    const reply =
      completion.choices[0]?.message?.content ??
      "I'm here to help with your trip plans! Tell me what you're in the mood for. 🌍";

    return NextResponse.json(
      {
        ok: true,
        reply,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("🔥 /api/chat error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "TripPuddy ran into a problem while generating a reply.",
        details: typeof err?.message === "string" ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
