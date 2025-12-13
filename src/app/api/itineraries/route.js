// src/app/api/itineraries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();

    // Call your Node-only handler
    const result = await handler(body);

    return NextResponse.json(result);
  } catch (err) {
    console.error("ITINERARY ROUTE ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Itinerary generation failed.",
        details: String(err?.message || err)
      },
      { status: 500 }
    );
  }
}
