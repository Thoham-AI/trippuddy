/**
 * Distance + routing helpers
 */
export const isValidCoord = (p) =>
  !!p &&
  typeof p.lat === "number" &&
  Number.isFinite(p.lat) &&
  typeof p.lon === "number" &&
  Number.isFinite(p.lon);

export const distKm = (p1, p2) => {
  if (!isValidCoord(p1) || !isValidCoord(p2)) return 0;
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export async function fetchRoute(prev, next, fallback) {
  if (!isValidCoord(prev) || !isValidCoord(next)) {
    return typeof fallback === "function" ? fallback(prev, next) : null;
  }

  const distance = distKm(prev, next);
  const profile = distance < 1.5 ? "foot-walking" : "driving-car";

  try {
    const res = await fetch("/api/route-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        coordinates: [
          [Number(prev.lon), Number(prev.lat)],
          [Number(next.lon), Number(next.lat)],
        ],
      }),
    });

    if (!res.ok) throw new Error("API Route failed");

    const json = await res.json();
    const feat = json?.features?.[0];
    const summary = feat?.properties?.summary || {};
    const coords = Array.isArray(feat?.geometry?.coordinates)
      ? feat.geometry.coordinates.map(([lon, lat]) => [lat, lon])
      : [
          [prev.lat, prev.lon],
          [next.lat, next.lon],
        ];

    return {
      mode: distance < 1.5 ? "walk" : "car",
      coords,
      distanceKm: summary.distance
        ? Number((summary.distance / 1000).toFixed(1))
        : Number(distance.toFixed(1)),
      minutes: summary.duration ? Math.round(summary.duration / 60) : 15,
    };
  } catch (err) {
    console.warn("FetchRoute API Error, using fallback:", err.message);
    return typeof fallback === "function"
      ? fallback(prev, next)
      : {
          mode: distance < 1.5 ? "walk" : "car",
          coords: [
            [prev.lat, prev.lon],
            [next.lat, next.lon],
          ],
          distanceKm: Number(distance.toFixed(1)),
          minutes: distance < 1.5 ? Math.round((distance / 4) * 60) : Math.round((distance / 30) * 60) + 3,
        };
  }
}

export async function buildRoutesAndTotals(activities, fetchRouteFn, userLocation) {
  let totalKm = 0;
  let totalMin = 0;
  const segments = [];

  const fullList = Array.isArray(activities) ? activities : [];
  if (fullList.length < 2) {
    return { segments, totals: { totalKm: 0, totalMin: 0 } };
  }

  for (let i = 1; i < fullList.length; i++) {
    const prev = fullList[i - 1]?.coordinates;
    const curr = fullList[i]?.coordinates;

    if (!isValidCoord(prev) || !isValidCoord(curr)) continue;

    const d = distKm(prev, curr);
    if (d > 500) continue;

    const routeData = await fetchRouteFn(prev, curr);
    if (!routeData) continue;

    totalKm += routeData.distanceKm || d;
    totalMin += routeData.minutes || 15;

    segments.push({
      mode: routeData.mode,
      latlngs: Array.isArray(routeData.coords) && routeData.coords.length ? routeData.coords : [[prev.lat, prev.lon], [curr.lat, curr.lon]],
      distance: routeData.distanceKm,
      duration: routeData.minutes,
    });

    if (fullList[i]) {
      fullList[i].travelTime = `${routeData.minutes || 15} min`;
      fullList[i].travelDistance = `${Number(routeData.distanceKm || d).toFixed(1)} km`;
    }
  }

  return {
    segments,
    totals: {
      totalKm: Number(totalKm.toFixed(1)),
      totalMin: Math.round(totalMin),
    },
  };
}
