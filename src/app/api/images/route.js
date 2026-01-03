// src/app/api/images/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 8000;

async function safeFetch(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

// Use ANY key you already have configured (works locally + Vercel)
function getGoogleKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_PLACES_API_KEY ||
    ""
  );
}

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function stableHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function unsplashSourceFallback(query) {
  const q = normalizeKey(query || "travel destination");
  const sig = stableHash(q);
  return `https://source.unsplash.com/featured/1200x700?${encodeURIComponent(
    query || "travel destination"
  )}&sig=${sig}`;
}

function googlePhotoURL(photoRef, apiKey) {
  if (!photoRef || !apiKey) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=${photoRef}&key=${apiKey}`;
}

async function placeDetailsByPlaceId(placeId, apiKey) {
  if (!apiKey || !placeId) return null;

  const detailURL =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}` +
    `&fields=name,geometry,formatted_address,photos,url,website` + // ✅ include website
    `&key=${apiKey}`;

  const dRes = await safeFetch(detailURL);
  if (!dRes || !dRes.ok) return null;

  const dJson = await dRes.json();
  const r = dJson?.result;
  if (!r) return null;

  return {
    placeId,
    name: r.name || null,
    address: r.formatted_address || null,
    lat: r.geometry?.location?.lat ?? null,
    lon: r.geometry?.location?.lng ?? null,
    photoRef: r.photos?.[0]?.photo_reference || null,
    mapsUrl: r.url || null,        // ✅ explicit Google Maps URL
    website: r.website || null,    // ✅ official website
  };
}

async function placeDetailsFromTextSearch(query, apiKey) {
  if (!apiKey || !query) return null;

  const textURL = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query
  )}&key=${apiKey}`;

  const tRes = await safeFetch(textURL);
  if (!tRes || !tRes.ok) return null;

  const tJson = await tRes.json();
  const first = tJson?.results?.[0];
  if (!first?.place_id) return null;

  return await placeDetailsByPlaceId(first.place_id, apiKey);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.max(1, Math.min(10, Number(searchParams.get("limit") || 1)));
    const placeId = (searchParams.get("placeId") || "").trim();

    const apiKey = getGoogleKey();

    let place = null;
    if (apiKey) {
      place = placeId
        ? await placeDetailsByPlaceId(placeId, apiKey)
        : await placeDetailsFromTextSearch(q, apiKey);
    }

    const images = [];
    if (place?.photoRef && apiKey) {
      images.push({ url: googlePhotoURL(place.photoRef, apiKey) });
    }
    while (images.length < limit) {
      images.push({ url: unsplashSourceFallback(q || "travel destination") });
    }

    return NextResponse.json({
      ok: true,
      images: images.slice(0, limit),
      place: place
        ? {
            placeId: place.placeId,
            lat: place.lat,
            lon: place.lon,
            name: place.name,
            address: place.address,
            mapsUrl: place.mapsUrl,     // ✅ always available when Google returns it
            website: place.website,     // ✅ official site when available
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Images lookup failed", images: [], place: null },
      { status: 500 }
    );
  }
}
