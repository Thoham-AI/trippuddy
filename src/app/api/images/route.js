import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

function normalizeKey(s = "") {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function findUnsplashImage(query) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !query) return null;

  const url =
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(query)}` +
    `&per_page=1&orientation=landscape&content_filter=high`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = await res.json();
  const first = json?.results?.[0];
  if (!first?.urls?.regular) return null;

  return {
    url: first.urls.regular,
    thumb: first.urls.thumb || first.urls.small || first.urls.regular,
    source: "unsplash",
    credit: first?.user?.name || null,
  };
}

async function findGooglePlacePhoto(placeId) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !placeId) return null;

  const detailsUrl =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=photos,name,formatted_address,url,website,geometry` +
    `&key=${key}`;

  const res = await fetch(detailsUrl, { cache: "no-store" });
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.result;
  const ref = result?.photos?.[0]?.photo_reference;
  if (!ref) return null;

  const photoUrl =
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=1200&photo_reference=${encodeURIComponent(ref)}` +
    `&key=${key}`;

  return {
    url: photoUrl,
    thumb: photoUrl,
    source: "google",
    place: {
      placeId,
      name: result?.name || null,
      address: result?.formatted_address || null,
      mapsUrl:
        result?.url ||
        `https://www.google.com/maps/place/?q=place_id:${placeId}`,
      website: result?.website || null,
      lat: result?.geometry?.location?.lat ?? null,
      lon: result?.geometry?.location?.lng ?? null,
    },
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const placeId = searchParams.get("placeId") || "";
    const queryKey = normalizeKey(q);

    const client = await clientPromise;
    const db = client.db();
    const photos = db.collection("photos");

    // 1) cache by placeId first
    if (placeId) {
      const cachedByPlace = await photos.findOne({ placeId });
      if (cachedByPlace?.url) {
        return NextResponse.json({
          ok: true,
          images: [{ url: cachedByPlace.url, thumb: cachedByPlace.thumb || cachedByPlace.url }],
          place: cachedByPlace.place || null,
          source: cachedByPlace.source || null,
          cached: true,
        });
      }
    }

    // 2) cache by query
    if (queryKey) {
      const cachedByQuery = await photos.findOne({ queryKey });
      if (cachedByQuery?.url) {
        return NextResponse.json({
          ok: true,
          images: [{ url: cachedByQuery.url, thumb: cachedByQuery.thumb || cachedByQuery.url }],
          place: cachedByQuery.place || null,
          source: cachedByQuery.source || null,
          cached: true,
        });
      }
    }

    // 3) Unsplash first
    if (queryKey) {
      const unsplash = await findUnsplashImage(q);
      if (unsplash?.url) {
        const doc = {
          placeId: placeId || null,
          queryKey,
          query: q,
          url: unsplash.url,
          thumb: unsplash.thumb,
          source: "unsplash",
          place: null,
          createdAt: new Date(),
        };

        await photos.updateOne(
          placeId ? { placeId } : { queryKey },
          { $set: doc },
          { upsert: true }
        );

        return NextResponse.json({
          ok: true,
          images: [{ url: unsplash.url, thumb: unsplash.thumb }],
          place: null,
          source: "unsplash",
          cached: false,
        });
      }
    }

    // 4) Google fallback only if placeId exists
    if (placeId) {
      const google = await findGooglePlacePhoto(placeId);
      if (google?.url) {
        const doc = {
          placeId,
          queryKey: queryKey || null,
          query: q || null,
          url: google.url,
          thumb: google.thumb,
          source: "google",
          place: google.place || null,
          createdAt: new Date(),
        };

        await photos.updateOne(
          { placeId },
          { $set: doc },
          { upsert: true }
        );

        return NextResponse.json({
          ok: true,
          images: [{ url: google.url, thumb: google.thumb }],
          place: google.place || null,
          source: "google",
          cached: false,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      images: [],
      place: null,
      source: null,
      cached: false,
    });
  } catch (err) {
    console.error("images route error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to resolve image" },
      { status: 500 }
    );
  }
}