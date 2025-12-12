import { NextResponse } from "next/server";
import OpenAI from "openai";

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* -------------------- Unsplash helper -------------------- */
async function fetchUnsplash(query, limit = 1) {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn("⚠️ No Unsplash key found, skipping to AI.");
    return [];
  }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    query
  )}&per_page=${limit}&client_id=${UNSPLASH_ACCESS_KEY}`;

  console.log("🔍 Fetching Unsplash for", query);

  try {
    const res = await fetch(url, { headers: { "Accept-Version": "v1" } });
    if (!res.ok) {
      console.warn(`❌ Unsplash HTTP ${res.status}`);
      return []; // ✅ continue to AI fallback
    }

    const data = await res.json();
    return (
      data.results?.map((photo) => ({
        url: photo.urls.small,
        alt: photo.alt_description || query,
        source: "Unsplash",
      })) || []
    );
  } catch (err) {
    console.warn("❌ Unsplash fetch failed:", err.message);
    return [];
  }
}

/* -------------------- OpenAI helper -------------------- */
async function generateAIImage(query) {
  if (!OPENAI_API_KEY) {
    console.warn("⚠️ No OpenAI key found, returning empty.");
    return [];
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    console.log("🧠 Generating AI image for:", query);
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: `A realistic travel photo of ${query}, ideal for itinerary UI`,
      size: "1024x1024",
    });

    const imgUrl = result.data?.[0]?.url;
    if (!imgUrl) return [];
    console.log("✅ AI image generated for:", query);
    return [{ url: imgUrl, alt: query, source: "AI" }];
  } catch (err) {
    console.error("AI image generation error:", err);
    return [];
  }
}

/* -------------------- Route handler -------------------- */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const limit = Number(searchParams.get("limit") || "1");

    console.log("📸 Image route triggered for:", query);

    let images = [];

    // 1️⃣ Try Unsplash first
    images = await fetchUnsplash(query, limit);

    // 2️⃣ Fallback to AI if Unsplash fails or empty
    if (!images.length) {
      console.log("🔁 Falling back to AI for:", query);
      images = await generateAIImage(query);
    }

    // 3️⃣ Always return something
    if (!images.length) {
      console.warn("⚠️ No image found, using fallback.");
      images = [{ url: "/fallback.jpg", alt: query, source: "Fallback" }];
    }

    return NextResponse.json({ images });
  } catch (err) {
    console.error("Image API route error:", err);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
