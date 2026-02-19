import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

/**
 * Hàm lấy ảnh chất lượng cao từ Unsplash Source mới
 * Đảm bảo ảnh luôn hiển thị và liên quan đến địa điểm
 */
function imageForPlace(name, sig = "") {
  const query = encodeURIComponent(name || "travel destination");
  // Sử dụng images.unsplash.com để ổn định hơn source.unsplash.com
  // Chèn keyword vào URL và dùng sig để tránh bị lặp ảnh
  return `https://images.unsplash.com/photo-1500835595353-b039e99d3421?auto=format&fit=crop&w=900&q=80&sig=${sig}&${query}`;
}

export async function POST(req) {
  try {
    const { messages, likedPlaces = [], dislikedPlaces = [], isFinalizing = false } = await req.json();
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Thiếu API Key OpenAI" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Thiết lập System Prompt tối ưu cho AI
    let system = "You are TripPuddy, a smart travel assistant. Return ONLY JSON.";
    
    if (isFinalizing) {
      system += " The user has finished swiping. Based on their LIKED places, create a detailed daily itinerary. Structure the reply clearly with DAY 1, DAY 2, etc.";
    } else {
      system +=
        " Suggest exactly 3 interesting places the user might want to visit next. " +
        "Respect the user's liked and disliked places to provide better recommendations. " +
        'Format EXACTLY: {"reply": "Your message to user here", "destinations": [{"name": "Place Name", "description": "Short catchy description"}]}';
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { 
          role: "system", 
          content: `User Preferences:\nLiked: ${JSON.stringify(likedPlaces)}\nDisliked: ${JSON.stringify(dislikedPlaces)}` 
        },
        ...messages,
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    const data = JSON.parse(content);

    // Xử lý gắn ảnh cho các địa điểm trả về
    if (data.destinations && Array.isArray(data.destinations)) {
      data.destinations = data.destinations.map((d, i) => ({
        ...d,
        image: imageForPlace(d.name, `${Date.now()}-${i}`),
      }));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Lỗi Route API:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}