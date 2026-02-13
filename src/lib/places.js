// src/lib/places.ts

const GOOGLE_PLACES_BASE =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

export type PlaceType = "cafe" | "restaurant" | "tourist_attraction";

export interface NearbyPlace {
  placeId: string;
  name: string;
  lat: number;
  lon: number;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types: string[];
  openNow?: boolean;
  address?: string;
  photoUrl?: string;
}

export async function getNearbyPlaces(params: {
  lat: number;
  lon: number;
  radiusMeters?: number;
  type?: PlaceType;
  keyword?: string;
  openNow?: boolean;
}): Promise<NearbyPlace[]> {
  const { lat, lon, radiusMeters = 2000, type, keyword, openNow = true } =
    params;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY / GOOGLE_MAPS_API_KEY");
  }

  const url = new URL(GOOGLE_PLACES_BASE);
  url.searchParams.set("location", `${lat},${lon}`);
  url.searchParams.set("radius", String(radiusMeters));
  if (type) url.searchParams.set("type", type);
  if (keyword) url.searchParams.set("keyword", keyword);
  if (openNow) url.searchParams.set("opennow", "true");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch nearby places");

  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Google Places error:", data.status, data.error_message);
    throw new Error("Google Places API error");
  }

  const results = (data.results || []) as any[];

  return results.map((p) => {
    const photoRef = p.photos?.[0]?.photo_reference as string | undefined;
    const photoUrl = photoRef
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${encodeURIComponent(
          photoRef
        )}&key=${apiKey}`
      : undefined;

    return {
      placeId: p.place_id,
      name: p.name,
      lat: p.geometry.location.lat,
      lon: p.geometry.location.lng,
      rating: p.rating,
      userRatingsTotal: p.user_ratings_total,
      priceLevel: p.price_level,
      types: p.types || [],
      openNow: p.opening_hours?.open_now,
      address: p.vicinity || p.formatted_address,
      photoUrl,
    };
  });
}
