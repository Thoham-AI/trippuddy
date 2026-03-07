import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb"; // Đảm bảo đã có file kết nối DB

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const input = (searchParams.get("input") || "").trim();
  const key = process.env.GOOGLE_PLACES_API_KEY;

  if (!key) return NextResponse.json({ error: "API Key missing" }, { status: 500 });
  if (!input) return NextResponse.json({ error: "Missing input" }, { status: 400 });

  try {
    // --- BƯỚC 1: CHECK DATABASE TRƯỚC (QUAN TRỌNG NHẤT) ---
    const client = await clientPromise;
    const db = client.db("trippuddy");
    const cachedProxy = await db.collection("google_cache").findOne({ query: input.toLowerCase() });
    
    if (cachedProxy) {
      console.log(`[Proxy Cache Hit] Trả về dữ liệu từ DB cho: ${input}`);
      return NextResponse.json(cachedProxy.data);
    }

    // --- BƯỚC 2: NẾU CHƯA CÓ TRONG DB MỚI GỌI GOOGLE ---
    // Chỉ lấy những field thực sự cần thiết để giảm chi phí
    const fields = "name,place_id,geometry,formatted_address,types";
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(input)}&key=${key}`;

    const searchRes = await fetch(searchUrl, { cache: "no-store" });
    const searchData = await searchRes.json();

    if (searchData.status !== "OK") {
      return NextResponse.json(searchData);
    }

    // --- BƯỚC 3: GIỚI HẠN DETAILS (CHỈ LẤY ĐIỂM ĐẦU TIÊN) ---
    // Thay vì dùng Promise.all cho 8 điểm, chỉ lấy Details cho kết quả tốt nhất để tiết kiệm tiền
    const bestPlace = searchData.results[0];
    let finalResult = bestPlace;

    try {
      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${bestPlace.place_id}&fields=name,geometry,formatted_address,url,website,photos&key=${key}`;
      const detailRes = await fetch(detailUrl, { cache: "no-store" });
      const detailData = await detailRes.json();
      if (detailData.result) {
        finalResult = { ...bestPlace, ...detailData.result };
      }
    } catch (e) {
      console.error("Detail fetch failed, using search data only.");
    }

    const responseData = {
      status: "OK",
      results: [finalResult], // Chỉ trả về 1 kết quả chất lượng nhất
    };

    // --- BƯỚC 4: LƯU VÀO CACHE ---
    await db.collection("google_cache").insertOne({
      query: input.toLowerCase(),
      data: responseData,
      createdAt: new Date()
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("PROXY ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}