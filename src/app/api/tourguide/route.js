// src/app/api/tourguide/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await handler(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("TOUR GUIDE ROUTE ERROR:", err);
    return NextResponse.json(
      { text: "Error generating guide info." },
      { status: 500 }
    );
  }
}
