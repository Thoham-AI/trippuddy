// src/app/api/packing-list/route.js
export const runtime = "nodejs";

import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const itinerary = body.itinerary;
    const result = await handler(itinerary);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ROUTE ERROR /api/packing-list:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Packing list failed" }),
      { status: 500 }
    );
  }
}
