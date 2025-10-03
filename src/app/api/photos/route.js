import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&client_id=${process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY}&per_page=1`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch Unsplash");
    }

    const data = await res.json();
    const photoUrl =
      data.results.length > 0 ? data.results[0].urls.regular : "/fallback.jpg";

    return NextResponse.json({ url: photoUrl });
  } catch (err) {
    console.error("Unsplash error:", err);
    return NextResponse.json({ url: "/fallback.jpg" });
  }
}
