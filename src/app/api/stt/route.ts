import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    console.log("📥 /api/stt HIT!");

    const form = await req.formData();
    const file = form.get("file") as Blob;

    if (!file) {
      return NextResponse.json({
        text: null,
        error: "No audio file received",
      });
    }

    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "json"
    });

    return NextResponse.json({ text: result.text, error: null });

  } catch (err: any) {
    console.error("❌ Whisper API Error:", err);

    // Safely return an error JSON (NEVER HTML)
    return NextResponse.json({
      text: null,
      error: err?.message || "Unknown STT error",
      code: err?.code || null,
      type: err?.type || null
    });
  }
}
