import OpenAI from "openai";

export default async function handleSTT(audio) {
  try {
    if (!audio) return { ok: false, text: "No audio provided." };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const res = await client.audio.transcriptions.create({
      file: buffer,
      model: "gpt-4o-transcribe"
    });

    return { ok: true, text: res.text };
  } catch (err) {
    return { ok: false, text: "Speech recognition failed.", details: String(err) };
  }
}
