import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    // Gọi GPT sinh điểm đến
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // nhẹ và nhanh
      messages: [
        {
          role: "user",
          content: `
Generate 3 travel destinations based on this prompt: "${prompt}".
Return ONLY JSON array, each item has:
- name
- country
- description
- reason
- image (use a generic Unsplash or Pexels image URL that fits)

Example:
[
  {
    "name": "Bali",
    "country": "Indonesia",
    "description": "Tropical paradise with beaches and temples",
    "reason": "Perfect for relaxation and culture",
    "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"
  }
]
        `,
        },
      ],
      temperature: 0.8,
    });

    let text = completion.choices[0].message.content.trim();

    // Nếu GPT trả kèm text ngoài JSON → lọc JSON ra
    const jsonMatch = text.match(/\[.*\]/s);
    const destinations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ destinations }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate destinations" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
