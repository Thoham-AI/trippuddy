import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const key = process.env.ORS_KEY || process.env.NEXT_PUBLIC_ORS_KEY;

    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${body.profile}/geojson`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": key, // Thử dùng key trực tiếp nếu Bearer lỗi
      },
      body: JSON.stringify({
        coordinates: body.coordinates,
        units: "km"
      }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}