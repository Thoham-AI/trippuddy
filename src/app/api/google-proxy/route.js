import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("input");
  
  // Ưu tiên lấy Key mới (không giới hạn domain)
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

  if (!key) {
    return NextResponse.json({ error: "API Key missing" }, { status: 500 });
  }

  // 1. Ép Google tìm danh sách địa điểm (Attractions) thay vì tìm 1 vùng địa lý
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent("top tourist attractions in " + input)}&key=${key}`;

  try {
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.status !== "OK" || !searchData.results) {
      return NextResponse.json(searchData);
    }

    // 2. Lấy dữ liệu "SÂU": Duyệt qua 8 địa điểm đầu tiên để lấy thêm chi tiết
    // Chúng ta dùng Promise.all để chạy song song cho nhanh
    const deepResults = await Promise.all(
      searchData.results.slice(0, 8).map(async (place) => {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,user_ratings_total,price_level,editorial_summary,opening_hours,photos,types&key=${key}`;
          const detailRes = await fetch(detailUrl);
          const detailData = await detailRes.json();
          
          // Hợp nhất dữ liệu thô từ Search và dữ liệu sâu từ Details
          return {
            ...place,
            ...(detailData.result || {}),
            // Tạo thêm một câu mô tả ngắn gọn nếu Google có summary
            description: detailData.result?.editorial_summary?.overview || "A great place to explore!"
          };
        } catch (err) {
          return place; // Nếu lỗi thì trả về dữ liệu thô ban đầu
        }
      })
    );

    return NextResponse.json({
      status: "OK",
      results: deepResults
    });

  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json({ error: "Failed to fetch deep data" }, { status: 500 });
  }
}