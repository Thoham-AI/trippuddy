// src/app/api/stt/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req) {
  try {
    // Must be inside POST()
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio) {
      return NextResponse.json(
        { ok: false, text: "No audio file received." },
        { status: 400 }
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer); // Node-only — must not run at top level

    const result = await client.audio.transcriptions.create({
      file: buffer,
      model: "gpt-4o-transcribe",
    });

    return NextResponse.json({ ok: true, text: result.text });
  } catch (err) {
    console.error("STT ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Speech recognition failed." },
      { status: 500 }
    );
  }
}
