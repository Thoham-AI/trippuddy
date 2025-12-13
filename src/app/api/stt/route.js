export const runtime = "nodejs";

import { NextResponse } from "next/dist/server/web/spec-extension/response";
import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio) {
      return NextResponse.json(
        { ok: false, text: "No audio received." },
        { status: 400 }
      );
    }

    const result = await handler(audio);
    return NextResponse.json(result);
  } catch (err) {
    console.error("STT ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Speech recognition failed." },
      { status: 500 }
    );
  }
}
