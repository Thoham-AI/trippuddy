// src/app/api/travel-plan/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const userInput = await request.json();

    // Prompt chi tiết cho AI
    const aiPrompt = `
    Tạo lịch trình du lịch chi tiết với thông tin sau:
    - Số người: ${userInput.numberOfPeople}
    - Độ tuổi: ${userInput.ages.join(', ')}
    - Sở thích: ${userInput.interests.join(', ')}
    - Ngân sách: ${userInput.budget}
    - Thời gian: ${userInput.duration} ngày
    - Phong cách: ${userInput.travelStyle}
    - Mùa: ${userInput.season}

    Yêu cầu format JSON:
    {
      "summary": "Tóm tắt lịch trình",
      "dailyItinerary": [
        {
          "day": 1,
          "date": "YYYY-MM-DD",
          "morning": "Hoạt động buổi sáng",
          "afternoon": "Hoạt động buổi chiều", 
          "evening": "Hoạt động buổi tối",
          "accommodation": "Gợi ý chỗ ở",
          "meals": "Gợi ý ăn uống",
          "budgetBreakdown": {
            "accommodation": 0,
            "activities": 0,
            "meals": 0,
            "transportation": 0
          }
        }
      ],
      "totalBudget": {
        "min": 0,
        "max": 0,
        "currency": "VND"
      },
      "packingList": ["item1", "item2"],
      "tips": ["tip1", "tip2"]
    }

    Hãy tạo lịch trình thực tế, chi tiết và phù hợp với thông tin người dùng.
    `;

    // Gọi AI API (OpenAI, Gemini, etc.)
    const aiResponse = await callAI(aiPrompt);
    
    return NextResponse.json(JSON.parse(aiResponse));

  } catch (error) {
    // Fallback với dữ liệu mẫu
    return NextResponse.json(getSampleItinerary());
  }
}

// Hàm gọi AI
async function callAI(prompt) {
  // Implementation với OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Dữ liệu mẫu fallback
function getSampleItinerary() {
  return {
    summary: "Lịch trình du lịch Đà Nẵng 3 ngày 2 đêm",
    dailyItinerary: [
      {
        day: 1,
        date: "2024-01-15",
        morning: "Check-in khách sạn, nghỉ ngơi",
        afternoon: "Tham quan Bà Nà Hills",
        evening: "Ăn tối tại nhà hàng địa phương",
        accommodation: "Khách sạn 3-4 sao trung tâm",
        meals: "Sáng: khách sạn, Trưa: Bà Nà Hills, Tối: hải sản",
        budgetBreakdown: {
          accommodation: 800000,
          activities: 500000,
          meals: 300000,
          transportation: 200000
        }
      }
      // ... more days
    ],
    totalBudget: {
      min: 5000000,
      max: 8000000,
      currency: "VND"
    },
    packingList: ["Áo phao", "Kem chống nắng", "Máy ảnh"],
    tips: ["Mang theo tiền mặt", "Đặt vé trước"]
  };
}