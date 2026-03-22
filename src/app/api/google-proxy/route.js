export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const input = searchParams.get("input");
    const location = searchParams.get("location");
    const radius = searchParams.get("radius") || "30000";

    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Missing Google Places API key" },
        { status: 500 }
      );
    }

    if (!input) {
      return Response.json(
        { error: "Missing input" },
        { status: 400 }
      );
    }

    let url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(input)}` +
      `&key=${apiKey}`;

    if (location) {
      url += `&location=${encodeURIComponent(location)}&radius=${encodeURIComponent(radius)}`;
    }

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    console.error("google-proxy error:", err);
    return Response.json(
      { error: "Google proxy failed" },
      { status: 500 }
    );
  }
}