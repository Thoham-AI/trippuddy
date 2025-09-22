import { NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Tạo 3 hình ảnh AI ví dụ
    const response = await openai.createImage({
      prompt,
      n: 3,
      size: "512x512",
    });

    const destinations = response.data.data.map((item, index) => ({
      name: `Destination ${index + 1}`,
      description: `AI-generated image for: "${prompt}"`,
      image: item.url,
    }));

    return NextResponse.json(destinations);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate destinations" }, { status: 500 });
  }
}
