// src/app/api/itineraries/route.js
export const runtime = "nodejs";

import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await handler(body);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("ROUTE ERROR /api/itineraries:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Itinerary failed" }),
      { status: 500 }
    );
  }
}
