// Node-only STT handler using Whisper API
import OpenAI from "openai";
import fs from "node:fs/promises";

export default async function handleSTT(audio) {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert Blob to Buffer
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const response = await client.audio.transcriptions.create({
      file: buffer,
      model: "gpt-4o-transcribe",
    });

    return { ok: true, text: response.text };
  } catch (err) {
    console.error("STT error:", err);
    return { ok: false, text: "Speech recognition failed." };
  }
}
