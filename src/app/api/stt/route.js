// src/app/api/stt/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handler from "./handler.node.js";

export async function POST(req) {
  try {
    // Expecting a Blob or File from the client
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile) {
      return NextResponse.json(
        { ok: false, text: "No audio file received." },
        { status: 400 }
      );
    }

    // Pass the Blob/File directly to your Node handler
    const result = await handler(audioFile);

    return NextResponse.json(result);
  } catch (err) {
    console.error("STT ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Speech recognition failed." },
      { status: 500 }
    );
  }
}
