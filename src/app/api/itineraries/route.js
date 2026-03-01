// src/app/api/itineraries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleItineraryRequest } from "./handler.node.js";

export async function POST(req) {
  try {
    const body = await req.json();

    // Thiết lập Base URL để fetch các API nội bộ (như lấy ảnh)
    if (!process.env.NEXT_PUBLIC_BASE_URL) {
      process.env.NEXT_PUBLIC_BASE_URL = req.nextUrl.origin;
    }

    // Truyền toàn bộ body (chứa tripCity, days, và userLocation) vào handler
    const result = await handleItineraryRequest(body);
    
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("ROUTE ERROR /api/itineraries:", err);
    return NextResponse.json(
      { ok: false, error: "Không thể tạo lịch trình. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}