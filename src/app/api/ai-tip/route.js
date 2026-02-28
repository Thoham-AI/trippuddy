import { NextResponse } from "next/server";

export async function POST(request) {
  const { placeName, location } = await request.json();
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;

  // 1. Danh sách Tip dự phòng (Phòng trường hợp mạng lag hoặc API chết)
  const fallbacks = [
    `Boss, ${placeName} is a must-visit spot in ${location}!`,
    `Boss, you'll find amazing vibes and photo spots at ${placeName}.`,
    `Boss, locals highly recommend checking out ${placeName}!`,
    `Boss, the scenery at ${placeName} is absolutely breathtaking.`
  ];
  const fallbackTip = fallbacks[Math.floor(Math.random() * fallbacks.length)];

  try {
    if (!apiKey) return NextResponse.json({ tip: fallbackTip });

    // 2. Dùng model gemini-pro (Dòng 1.0 cực kỳ ổn định, ít lỗi 404 hơn Flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Give a 1-sentence travel tip for ${placeName} in ${location}. Start with "Boss, ..."` }] }]
      })
    });

    const data = await response.json();

    // Nếu vẫn lỗi 404 hoặc 400, trả về Tip dự phòng ngay lập tức
    if (data.error || !data.candidates) {
      console.warn("AI ROUTE: API Error, using fallback.");
      return NextResponse.json({ tip: fallbackTip });
    }

    const tip = data.candidates[0].content.parts[0].text;
    return NextResponse.json({ tip });

  } catch (error) {
    console.error("AI ROUTE FINAL FALLBACK:", error.message);
    return NextResponse.json({ tip: fallbackTip });
  }
}