// src/app/api/images/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

// Access env vars only when needed
function getKeys() {
  return {
    UNSPLASH: process.env.UNSPLASH_ACCESS_KEY,
    OPENAI: process.env.OPENAI_API_KEY,
  };
}

/* -------------------- Unsplash helper -------------------- */
async function fetchUnsplash(query, limit, keys) {
  if (!keys.UNSPLASH) return [];

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    query
  )}&per_page=${limit}&client_id=${keys.UNSPLASH}`;

  try {
    const res = await fetch(url, { headers: { "Accept-Version": "v1" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (
      data.results?.map((photo) => ({
        url: photo.urls.small,
        alt: photo.alt_description || query,
        source: "Unsplash",
      })) || []
    );
  } catch {
    return [];
  }
}

/* -------------------- AI image fallback -------------------- */
async function generateAIImage(query, keys) {
  if (!keys.OPENAI) return [];

  const client = new OpenAI({ apiKey: keys.OPENAI });

  try {
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: `A realistic travel photo of ${query}, ideal for itinerary UI`,
      size: "1024x1024",
    });

    const imgUrl = result.data?.[0]?.url;
    if (!imgUrl) return [];

    return [{ url: imgUrl, alt: query, source: "AI" }];
  } catch {
    return [];
  }
}

/* ------------------ GET route handler --------------------- */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const limit = Number(searchParams.get("limit") || "1");

    const keys = getKeys();

    let images = await fetchUnsplash(query, limit, keys);

    if (!images.length) {
      images = await generateAIImage(query, keys);
    }

    if (!images.length) {
      images = [{ url: "/fallback.jpg", alt: query, source: "Fallback" }];
    }

    return NextResponse.json({ images });
  } catch (err) {
    console.error("IMAGE ROUTE ERROR:", err);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
