// src/app/api/packing-list/route.js
export const runtime = "nodejs";

const handler = require("./handler.node.js");

module.exports.POST = async function (req) {
  try {
    const body = await req.json();
    const result = await handler(body.itinerary);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("ROUTE ERROR /api/packing-list:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Packing list failed" }),
      { status: 500 }
    );
  }
};
