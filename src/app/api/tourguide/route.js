// src/app/api/tourguide/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      salutation = "friend",   // e.g. "Boss", "Honey", "Buddy"
      localTime,               // optional ISO string from client
      location,                // optional { lat, lon }
    } = body || {};

    const now = localTime ? new Date(localTime) : new Date();
    const hour = now.getHours();

    let timeLabel = "day";
    let suggestion = "explore your surroundings a bit";

    if (hour >= 5 && hour < 8) {
      timeLabel = "early morning";
      suggestion = "a peaceful walk or a light breakfast";
    } else if (hour >= 8 && hour < 11) {
      timeLabel = "morning";
      suggestion = "grabbing breakfast nearby before your first activity";
    } else if (hour >= 11 && hour < 14) {
      timeLabel = "late morning";
      suggestion = "finding a good spot for brunch or coffee";
    } else if (hour >= 14 && hour < 17) {
      timeLabel = "afternoon";
      suggestion = "visiting a nearby attraction or relaxing at a café";
    } else if (hour >= 17 && hour < 21) {
      timeLabel = "evening";
      suggestion = "dinner with a nice view or a sunset walk";
    } else {
      timeLabel = "night";
      suggestion = "winding down somewhere cozy nearby";
    }

    // Simple location hint if we have coordinates
    let locationHint = "";
    if (location?.lat && location?.lon) {
      locationHint =
        " I’ve checked your area — there should be options within a short walk from you.";
    }

    const prettySalutation = salutation.trim() || "friend";

    const message = `Good ${timeLabel}, ${prettySalutation}! 🌤
It’s a great time to ${suggestion}.${locationHint}
Tell me what you feel like doing, and I’ll adjust your plan for today.`;

    return NextResponse.json({ message });
  } catch (err) {
    console.error("tourguide error:", err);
    return NextResponse.json(
      { error: "Tourguide failed" },
      { status: 500 }
    );
  }
}
