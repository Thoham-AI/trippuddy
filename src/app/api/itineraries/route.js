// src/app/api/itineraries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handleItineraryRequest from "./handler.node.js";

export async function POST(req) {
  try {
    const json = await req.json();
    const result = await handleItineraryRequest(json);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Itinerary error:", err);
    return NextResponse.json(
      { ok: false, error: "Itinerary generation failed" },
      { status: 500 }
    );
  }
}
