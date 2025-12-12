// src/app/api/packing-list/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handlePackingList from "./handler.node.js";

export async function POST(req) {
  try {
    const { itinerary } = await req.json();
    const result = await handlePackingList(itinerary);

    if (!result.ok) {
      return NextResponse.json(
        { text: result.text, error: result.details || null },
        { status: 500 }
      );
    }

    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("packing-list wrapper error:", err);
    return NextResponse.json(
      { text: "Error generating packing list." },
      { status: 500 }
    );
  }
}
