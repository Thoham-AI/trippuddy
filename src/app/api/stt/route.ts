export const runtime = "nodejs";

import { NextResponse } from "next/server";
import handleSTT from "./handler.node.mjs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json(
        { ok: false, text: "No audio file provided." },
        { status: 400 }
      );
    }

    const result = await handleSTT(audio);
    return NextResponse.json(result);
  } catch (err) {
    console.error("STT wrapper error:", err);
    return NextResponse.json(
      { ok: false, text: "STT route failed." },
      { status: 500 }
    );
  }
}
