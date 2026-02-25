import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    // 1. Kiểm tra đầu vào
    const body = await req.json().catch(() => ({}));
    const { placeName, location, types } = body;

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;

    // 2. Kiểm tra Key (In ra Terminal để Boss soi)
    if (!apiKey) {
      console.error("❌ ERROR: GOOGLE_GENAI_API_KEY is missing!");
      return NextResponse.json({ tip: "Boss, your AI key is missing in .env.local!" });
    }

    // 3. Khởi tạo AI với cơ chế bảo vệ
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Write a one-sentence catchy travel tip in English (max 15 words) for a tourist visiting "${placeName || 'this place'}" in "${location || 'this city'}". 
    Friendly vibe, start with 'Boss,'. No hashtags.`;

    // 4. Gọi AI với Timeout/Error Handling
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ tip: text.trim() });

  } catch (error) {
    // 5. TUYỆT ĐỐI KHÔNG TRẢ VỀ STATUS 500
    // Thay vì chết, hãy trả về một câu mặc định để thẻ vẫn hiện đẹp
    console.error("AI ROUTE LOG:", error.message);

    // Kiểm tra các lỗi phổ biến
    let fallbackMsg = "A wonderful spot for your next adventure, Boss!";
    if (error.message.includes("fetch is not defined")) {
      fallbackMsg = "Node.js version too old. Please update to v20+";
    }

    return NextResponse.json({ tip: fallbackMsg });
  }
}