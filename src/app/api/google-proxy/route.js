import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input");
  
  // Lấy Key mới (không giới hạn domain) để chạy được trên cả Local và Server
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  if (!key) {
    return NextResponse.json({ error: "API Key missing" }, { status: 500 });
  }

// Thêm "tourist attractions in" để ép Google trả về danh sách địa điểm thay vì 1 thành phố
const googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent("tourist attractions in " + input)}&key=${key}`;

  try {
    const res = await fetch(googleUrl);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch Google API" }, { status: 500 });
  }
}