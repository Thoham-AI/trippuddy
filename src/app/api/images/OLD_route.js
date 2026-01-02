import { NextResponse } from "next/server";

/**
 * End-to-end fix summary:
 * 1) Generate itinerary activities (your existing logic) -> baseItinerary
 * 2) Enrich EACH activity with:
 *    - imageUrl: deterministic per activity
 *    - lat/lon: geocoded per activity (not userLocation, not country centroid)
 * 3) Return enriched itinerary; UI renders from the activity object only.
 *
 * Notes:
 * - Uses OpenStreetMap Nominatim for geocoding (no API key). Rate-limited in production.
 *   If you have Google/Mapbox, swap geocode() implementation.
 * - Uses Unsplash "source" endpoint for images (no key). Deterministic with ?sig=hash.
 *   If you already have a photo provider, swap buildImageUrl().
 */

// ---- Small in-memory caches to prevent re-fetching same destinations during dev ----
const GEO_CACHE = new Map();   // key -> { lat, lon }
const IMG_CACHE = new Map();   // key -> imageUrl

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function stableHash(str) {
  // Simple stable hash for deterministic image "sig"
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

async function geocode(query) {
  const key = normalizeKey(query);
  if (!key) return null;
  if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
    }).toString();

  // Nominatim requires a User-Agent; in serverless it’s best effort.
  const res = await fetch(url, {
    headers: {
      "User-Agent": "travel-ai-app/1.0 (itinerary geocoder)",
      "Accept-Language": "en",
    },
    // Keep it simple; you can add next: { revalidate: 86400 } later.
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const result = { lat, lon };
  GEO_CACHE.set(key, result);
  return result;
}

function buildImageUrl({ title, city, country }) {
  // Deterministic query + sig so images don’t “shift” across activities.
  const q = [title, city, country].filter(Boolean).join(", ");
  const sig = stableHash(normalizeKey(q));
  // Unsplash source endpoint:
  // - deterministic via sig
  // - returns a real image URL (redirect)
  return `https://source.unsplash.com/featured/1200x700?${encodeURIComponent(
    q
  )}&sig=${sig}`;
}

async function resolveImageUrl(activity) {
  const key = normalizeKey([activity.title, activity.city, activity.country].filter(Boolean).join("|"));
  if (!key) return null;
  if (IMG_CACHE.has(key)) return IMG_CACHE.get(key);

  const url = buildImageUrl(activity);
  IMG_CACHE.set(key, url);
  return url;
}

function makeGeoQuery(activity) {
  // Most specific -> least specific
  const parts = [];
  if (activity.title) parts.push(activity.title);
  if (activity.address) parts.push(activity.address);
  if (activity.city) parts.push(activity.city);
  if (activity.country) parts.push(activity.country);

  // If title is generic (“Dinner”, “Hotel”), fallback to city/country
  const q = parts.join(", ").trim();
  if (q.length < 3) return [activity.city, activity.country].filter(Boolean).join(", ");
  return q;
}

async function enrichActivity(activity) {
  // Ensure stable fields exist
  const title = activity.title || activity.name || activity.place || "";
  const city = activity.city || activity.destinationCity || "";
  const country = activity.country || activity.destinationCountry || "";

  const normalized = {
    ...activity,
    title,
    city,
    country,
  };

  // 1) Geo: activity-specific query; NO fallback to userLocation (that caused wrong pins)
  let lat = normalized.lat;
  let lon = normalized.lon;

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    const query = makeGeoQuery(normalized);
    const geo = await geocode(query);

    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    } else {
      // If geocode fails, do NOT lie by using userLocation.
      // Keep nulls so UI can display "location unavailable" rather than wrong pin.
      lat = null;
      lon = null;
    }
  } else {
    lat = Number(lat);
    lon = Number(lon);
  }

  // 2) Image: always per-activity; NEVER reuse previous
  let imageUrl = normalized.imageUrl || normalized.image || null;
  if (!imageUrl) {
    imageUrl = await resolveImageUrl({ title, city, country });
  }

  // 3) Stable ID for React keys / DnD
  const idBase = normalizeKey([title, city, country, normalized.startTime, normalized.day].filter(Boolean).join("|"));
  const id = normalized.id || `act_${stableHash(idBase)}`;

  return {
    ...normalized,
    id,
    lat,
    lon,
    imageUrl,
  };
}

/**
 * Replace this function with your existing itinerary generation.
 * The important part is: it returns an object with an array of activities.
 */
async function generateBaseItinerary({ userPrompt, userLocation }) {
  // KEEP your current logic here (LLM call, parsing, etc.)
  // Example shape:
  return {
    days: [
      {
        day: 1,
        date: null,
        activities: [
          {
            title: "Clarke Quay",
            city: "Singapore",
            country: "Singapore",
            startTime: "16:30",
            description: "Explore the vibrant riverside area with shops and restaurants.",
          },
        ],
      },
    ],
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { userPrompt, userLocation } = body || {};

    // 1) Generate
    const baseItinerary = await generateBaseItinerary({ userPrompt, userLocation });

    // 2) Enrich atomically per activity
    const enrichedDays = [];
    for (const day of baseItinerary.days || []) {
      const enrichedActivities = [];
      for (const act of day.activities || []) {
        enrichedActivities.push(await enrichActivity({ ...act, day: day.day }));
      }
      enrichedDays.push({ ...day, activities: enrichedActivities });
    }

    return NextResponse.json({
      itinerary: {
        ...baseItinerary,
        days: enrichedDays,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
