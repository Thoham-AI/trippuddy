// src/app/api/stt/route.js
export const runtime = "nodejs";

import handler from "./handler.node.js";

export async function POST(req) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const result = await handler(audio);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ROUTE ERROR /api/stt:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Speech-to-text failed" }),
      { status: 500 }
    );
  }
}
