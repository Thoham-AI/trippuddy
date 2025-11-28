import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    let body = {};

    // SAFELY PARSE BODY
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const {
      message = "",
      salutation = "friend",
      location, // { lat, lon } or null
    } = body;

    const text = message?.trim() || "";

    if (!text) {
      return NextResponse.json({
        reply:
          "I didn’t catch that. Tell me what you’d like help with – food, activities, or planning your day.",
      });
    }

    const lower = text.toLowerCase();
    const prettySalutation = salutation?.trim() || "friend";

    // Normalize Vietnamese accents
    const normalize = (str) =>
      str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const norm = normalize(lower);

    // LOCATION HINT FIX
    let locationHint = "";
    if (
      location &&
      typeof location.lat === "number" &&
      typeof location.lon === "number"
    ) {
      locationHint = " around your current area (based on your location).";
    }

    let reply;

    // GREETINGS (English + Vietnamese, accent-free)
    if (
      /^(hi|hello|hey|yo)/.test(norm) ||
      norm.startsWith("chao") || // "chào", "chao", "chao ban"
      norm.startsWith("xin chao") ||
      norm.includes("how are you")
    ) {
      reply = `Hi ${prettySalutation}! 👋
I’m your TripPuddy travel buddy. Tell me what you feel like doing – food, cafés, sightseeing, or planning your day – and I’ll suggest something that fits.`;
    }

    // CAFÉS
    else if (
      norm.includes("cafe") ||
      norm.includes("coffee") ||
      lower.includes("café")
    ) {
      reply = `I can definitely help you find a café, ${prettySalutation}! ☕
Tell me what style you prefer (quiet to work, hipster, local only, or with a great view) and your budget, and I’ll suggest a few ideas${locationHint || "."}
For best results, keep location permission on so I can be more specific.`;
    }

    // FOOD
    else if (
      norm.includes("food") ||
      norm.includes("restaurant") ||
      norm.includes("eat") ||
      norm.includes("breakfast") ||
      norm.includes("lunch") ||
      norm.includes("dinner")
    ) {
      reply = `Hungry, ${prettySalutation}? 🍽️
Tell me what you feel like (e.g. “cheap local street food”, “nice date night dinner”, or “quick lunch near me”) and I’ll suggest a few options${locationHint || "."}
If you share any dietary preferences (halal, vegetarian, etc.), I’ll factor that in too.`;
    }

    // ITINERARY
    else if (
      norm.includes("plan") ||
      norm.includes("itinerary") ||
      norm.includes("today") ||
      norm.includes("what should i do") ||
      norm.includes("things to do")
    ) {
      reply = `Let’s plan your day, ${prettySalutation}! 🗺️
Tell me:
• How much time you have (half day / full day)
• Your energy level (chill / normal / adventurous)
• Rough budget (low / medium / high)
and I’ll suggest a mini itinerary for today${locationHint || "."}`;
    }

    // DEFAULT
    if (!reply) {
      reply = `Got it, ${prettySalutation}.  
You said: “${text}”.

I can help you with:
• Finding cafés or food nearby  
• Suggesting things to do today  
• Creating a mini itinerary  
• Adjusting your plan based on weather or time of day  

Tell me which of these you want, or say something like  
“Plan a relaxed afternoon for me” or “Find a quiet café to work in”${locationHint || "."}`;
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("chat error:", err);
    return NextResponse.json(
      {
        reply:
          "Sorry, something went wrong. Please try again or rephrase your request.",
      },
      { status: 500 }
    );
  }
}
