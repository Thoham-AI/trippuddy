// src/app/api/stt/route.js
export const runtime = "nodejs";

const handler = require("./handler.node.js");

module.exports.POST = async function (req) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const result = await handler(audio);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("ROUTE ERROR /api/stt:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "STT failed" }),
      { status: 500 }
    );
  }
};
