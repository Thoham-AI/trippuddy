// src/app/api/stt/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio) {
      return NextResponse.json(
        { ok: false, text: "No audio file received." },
        { status: 400 }
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const response = await client.audio.transcriptions.create({
      file: buffer,
      model: "gpt-4o-transcribe",
    });

    return NextResponse.json({ ok: true, text: response.text });
  } catch (err) {
    console.error("STT ROUTE ERROR:", err);
    return NextResponse.json(
      { ok: false, text: "Speech recognition failed." },
      { status: 500 }
    );
  }
}
