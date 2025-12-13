export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await handler(body.itinerary);
    return NextResponse.json(result);
  } catch (err) {
    console.error("PACKING LIST ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Packing list generation failed." },
      { status: 500 }
    );
  }
}
