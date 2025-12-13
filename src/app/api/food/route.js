// src/app/api/food/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await handler(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("FOOD ROUTE ERROR:", err);
    return NextResponse.json({ text: "Error getting food suggestions." }, { status: 500 });
  }
}
