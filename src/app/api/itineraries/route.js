// src/app/api/itineraries/route.js
// Node runtime to support dynamic OpenAI import and external fetches.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleItineraryRequest } from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();

    // Ensure server-side fetches to internal routes use an absolute base URL.
    // This prevents relative fetch("/api/images") failures in Node runtime.
    if (!process.env.NEXT_PUBLIC_BASE_URL) {
      process.env.NEXT_PUBLIC_BASE_URL = req.nextUrl.origin;
    }
    const result = await handleItineraryRequest(body);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("ROUTE ERROR /api/itineraries:", err);
    return NextResponse.json(
      { ok: false, error: "Itinerary failed" },
      { status: 500 }
    );
  }
}
