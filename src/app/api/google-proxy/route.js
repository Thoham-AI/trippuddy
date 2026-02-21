import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input");
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  const googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(input + " tourism")}&key=${key}`;

  try {
    const res = await fetch(googleUrl);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch Google API" }, { status: 500 });
  }
}