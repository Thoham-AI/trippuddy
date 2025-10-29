"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";

// Client-only Leaflet map
const LeafletMap = dynamic(() => import("./components/LeafletMap.jsx"), {
  ssr: false,
});

// dnd-kit
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableActivity({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none" }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/* ----------------------- helpers ----------------------- */

const R = 6371;
const toRad = (d) => (d * Math.PI) / 180;

const distKm = (a, b) => {
  if (!a || !b) return 0;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const modeFor = (dKm) => (dKm < 1 ? "walk" : "drive");
const iconFor = (mode) => (mode === "walk" ? "🚶" : "🚕");
const minutesToStr = (mins, mode) =>
  mins < 1 ? "Walking distance" : `${Math.round(mins)} min ${mode === "walk" ? "walk" : "by Taxi"}`;
const fallbackMinutes = (dKm, mode) =>
  mode === "walk" ? (dKm / 4) * 60 : (dKm / 30) * 60 + 3;

async function fetchRoute(prev, next) {
  if (!prev || !next) {
    return { mode: "walk", label: null, minutes: 0, coords: [], steps: [] };
  }
  const dKm = distKm(prev, next);
  const mode = modeFor(dKm);
  const key = process.env.NEXT_PUBLIC_ORS_KEY;

  if (!key) {
    const mins = fallbackMinutes(dKm, mode);
    return {
      mode,
      label: minutesToStr(mins, mode),
      minutes: Math.round(mins),
      coords: [
        [prev.lat, prev.lon],
        [next.lat, next.lon],
      ],
      steps: [],
    };
  }

  try {
    const profile = mode === "walk" ? "foot-walking" : "driving-car";
    const res = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profile}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          coordinates: [
            [prev.lon, prev.lat],
            [next.lon, next.lat],
          ],
          instructions: true,
          units: "km",
          geometry: true,
          geometry_format: "geojson",
        }),
      }
    );

    if (!res.ok) {
      const mins = fallbackMinutes(dKm, mode);
      return {
        mode,
        label: minutesToStr(mins, mode),
        minutes: Math.round(mins),
        coords: [
          [prev.lat, prev.lon],
          [next.lat, next.lon],
        ],
        steps: [],
      };
    }

let json;
try {
  json = await res.json();
} catch (err) {
  console.error("❌ JSON parse failed:", err);
  const text = await res.text().catch(() => "no body");
  console.error("❌ Raw response:", text);
  alert("Server returned invalid JSON — check console log 🔍");
  throw err;
}
    const feat = json?.features?.[0];
    const secs = feat?.properties?.summary?.duration || 0;
    const coordsLonLat = feat?.geometry?.coordinates || [];
    const steps =
      feat?.properties?.segments?.[0]?.steps?.map((s) => ({
        instruction: s.instruction,
        distance_m: s.distance,
        duration_s: s.duration,
        name: s.name,
      })) || [];

    const coords = coordsLonLat.map(([lon, lat]) => [lat, lon]); // lat,lon
    const mins = secs ? secs / 60 : fallbackMinutes(dKm, mode);

    return { mode, label: minutesToStr(mins, mode), minutes: Math.round(mins), coords, steps };
  } catch {
    const mins = fallbackMinutes(dKm, mode);
    return {
      mode,
      label: minutesToStr(mins, mode),
      minutes: Math.round(mins),
      coords: [
        [prev.lat, prev.lon],
        [next.lat, next.lon],
      ],
      steps: [],
    };
  }
}

async function buildRoutesAndTotals(activities, mutateTravelTime = true) {
  const segments = [];
  let totalKm = 0;
  let walkMin = 0;
  let driveMin = 0;

  for (let i = 1; i < activities.length; i++) {
    const A = activities[i - 1]?.coordinates;
    const B = activities[i]?.coordinates;
    if (!A || !B) {
      segments.push(null);
      continue;
    }

    const dKm = distKm(A, B);
    totalKm += dKm;

    const route = await fetchRoute(A, B);
    if (mutateTravelTime) activities[i].travelTime = route.label;

    if (route.mode === "walk") walkMin += route.minutes;
    else driveMin += route.minutes;

    segments.push({
      mode: route.mode, // "walk" | "drive"
      latlngs: route.coords, // [[lat,lon],...]
      steps: route.steps,
    });
  }

  return {
    segments,
    totals: {
      totalKm: Number(totalKm.toFixed(1)),
      walkMin,
      driveMin,
      totalMin: walkMin + driveMin,
    },
  };
}

function mixedOptimizeActivities(activities) {
  if (!activities?.length) return activities;
  const THRESH = 0.9;
  const remaining = [...activities];
  const clusters = [];

  while (remaining.length) {
    const seed = remaining.shift();
    const cluster = [seed];
    for (let i = remaining.length - 1; i >= 0; i--) {
      const cand = remaining[i];
      const A = seed.coordinates;
      const B = cand.coordinates;
      if (!A || !B) continue;
      if (distKm(A, B) <= THRESH) {
        cluster.push(cand);
        remaining.splice(i, 1);
      }
    }
    clusters.push(cluster);
  }

  const orderCluster = (list) => {
    if (list.length <= 2) return list;
    const result = [list[0]];
    const un = list.slice(1);
    while (un.length) {
      const last = result[result.length - 1];
      let idx = 0;
      let best = Infinity;
      for (let i = 0; i < un.length; i++) {
        const d = distKm(last.coordinates, un[i].coordinates);
        if (d < best) {
          best = d;
          idx = i;
        }
      }
      result.push(un.splice(idx, 1)[0]);
    }
    return result;
  };

  const orderedInClusters = clusters.map(orderCluster);

  const centroids = orderedInClusters.map((cl) => {
    const pts = cl
      .map((a) => a.coordinates)
      .filter(Boolean)
      .map((c) => [c.lat, c.lon]);
    const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return { lat, lon };
  });

  const order = [0];
  const pool = Array.from({ length: orderedInClusters.length }, (_, i) => i).slice(1);
  while (pool.length) {
    const last = order[order.length - 1];
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const idx = pool[i];
      const d = distKm(centroids[last], centroids[idx]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    order.push(pool.splice(bestIdx, 1)[0]);
  }

  const flattened = [];
  for (const ci of order) flattened.push(...orderedInClusters[ci]);
  return flattened;
}

/* ----------------------- main component ----------------------- */

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ itinerary: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [activeDay, setActiveDay] = useState(0);

  const [routesByDay, setRoutesByDay] = useState({}); // { [idx]: { segments, totals } }
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [savingsByDay, setSavingsByDay] = useState({});

  // ✅ Option A — validate geolocation; do NOT use for routing if inaccurate
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords || {};
        if (!latitude || !longitude || !accuracy || accuracy > 1000) {
          // hide inaccurate location for routing
          setUserLocation(null);
          return;
        }
        setUserLocation({ lat: latitude, lon: longitude });
      },
      () => setUserLocation(null),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
    );
  }, []);

  const flag = (c) =>
    c
      ? c
          .toUpperCase()
          .split("")
          .map((x) => String.fromCodePoint(127397 + x.charCodeAt()))
          .join("")
      : "";

  const recomputeDay = async (idx, itinerary) => {
    const day = itinerary[idx];
    if (!day?.activities?.length) return;
    const bundle = await buildRoutesAndTotals(day.activities);
    setRoutesByDay((prev) => ({ ...prev, [idx]: bundle }));

    // savings vs optimized
    const acts = day.activities;
    const optimized = mixedOptimizeActivities(acts);
    const currentTotals = bundle.totals;
    const optBundle = await buildRoutesAndTotals([...optimized], false);
    const saved = Math.max(
      0,
      (currentTotals.totalMin || 0) - (optBundle.totals.totalMin || 0)
    );
    setSavingsByDay((prev) => ({ ...prev, [idx]: saved }));
  };

  const recomputeAll = async (it) => {
    for (let i = 0; i < it.length; i++) await recomputeDay(i, it);
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userLocation }), // userLocation not routed; only for POIs
      });

      const json = await res.json();

      // Travel label between adjacent activities (guarded)
      for (const day of json.itinerary) {
        const promises = day.activities.map(async (a, i) => {
          if (i === 0) {
            a.travelTime = null;
            return;
          }
          const prev = day.activities[i - 1]?.coordinates;
          const cur = a.coordinates;
          if (!prev || !cur) {
            a.travelTime = null;
            return;
          }
          const route = await fetchRoute(prev, cur);
          a.travelTime = route.label;
        });
        await Promise.all(promises);
      }

      setData(json);
      setActiveDay(0);
      setShowRouteMap(false);
      await recomputeAll(json.itinerary);
    } finally {
      setLoading(false);
    }
  };

  const optimizeActiveDay = async () => {
    const it = [...data.itinerary];
    const acts = it[activeDay]?.activities || [];
    if (acts.length < 3) return;
    const optimized = mixedOptimizeActivities(acts);
    it[activeDay] = { ...it[activeDay], activities: optimized };
    setData({ ...data, itinerary: it });
    await recomputeDay(activeDay, it);
  };

  const daySummary = (idx) => {
    const totals = routesByDay[idx]?.totals;
    const acts = data.itinerary[idx]?.activities || [];
    if (!totals || !acts.length) return null;
    const { totalKm, walkMin, driveMin } = totals;
    const parts = [];
    if (walkMin) parts.push(`🚶 ${walkMin}m`);
    if (driveMin) parts.push(`🚕 ${driveMin}m`);
    return `${totalKm.toFixed(1)} km travel · ${acts.length} stops${parts.length ? " — " + parts.join(" + ") : ""}`;
  };

  // DnD
  const itemsForDay = useMemo(
    () => data.itinerary?.[activeDay]?.activities.map((_, i) => `act-${i}`) || [],
    [data.itinerary, activeDay]
  );

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const it = [...data.itinerary];
    const acts = it[activeDay].activities;
    const from = +active.id.split("-")[1];
    const to = +over.id.split("-")[1];
    it[activeDay].activities = arrayMove(acts, from, to);
    setData({ ...data, itinerary: it });
    await recomputeDay(activeDay, it);
  };

  // CSV
  const exportCSV = () => {
    const rows = [["Day", "Title", "Time", "Location", "Travel Time"]];
    data.itinerary.forEach((day) =>
      day.activities.forEach((act) => {
        const loc = act.location || {};
        rows.push([
          day.day,
          act.title,
          act.time,
          `${loc.name}${loc.city ? ", " + loc.city : ""}`,
          act.travelTime || "",
        ]);
      })
    );
    const csv = Papa.unparse(rows);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv]));
    link.download = "itinerary.csv";
    link.click();
  };

  // Bounds for full-day fit
  const fullDayBounds = useMemo(() => {
    const acts = data.itinerary[activeDay]?.activities || [];
    const pts = acts
      .map((a) => a.coordinates)
      .filter(Boolean)
      .map((c) => [c.lat, c.lon]);
    return pts.length ? pts : null;
  }, [data.itinerary, activeDay]);

  // Optimize recommendation (Option C)
  const savedMin = savingsByDay[activeDay] || 0;
  const showOptimizeRecommend = savedMin >= 8;
  const optimizeLabel = showOptimizeRecommend
    ? `Improve Route (save ${Math.round(savedMin)}m)`
    : `Optimize day`;

  // Helper: get only the previous→current segment for the small card map
  const segmentForIndex = (segments, i) => {
    if (!segments || i <= 0) return [];
    const seg = segments[i - 1];
    return seg ? [seg] : [];
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Banner */}
      <div style={{ width: "100%", height: 260, overflow: "hidden" }}>
        <img
          src="/banner.jpg"
          alt="Banner"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div style={{ maxWidth: 1100, margin: "20px auto", padding: "0 16px" }}>
        {/* Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input
            placeholder="3 days Singapore food & culture"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />
          <button
            disabled={loading}
            onClick={generate}
            style={{
              background: "#1e3a8a",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: 8,
            }}
          >
            {loading ? "Loading…" : "Generate"}
          </button>
        </div>

        {/* Day controls */}
        {data.itinerary.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {data.itinerary.map((_, i) => (
              <button
                key={i}
                onClick={() => { setActiveDay(i); setShowRouteMap(false); }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  background: activeDay === i ? "#1e3a8a" : "#e5e7eb",
                  color: activeDay === i ? "#fff" : "#111",
                }}
              >
                Day {i + 1}
              </button>
            ))}
            <div style={{ marginLeft: "auto", fontWeight: 600 }}>
              📅 {daySummary(activeDay)}
            </div>

            <button
              onClick={optimizeActiveDay}
              title="Mixed cluster optimization"
              style={{
                background: showOptimizeRecommend ? "#0ea5e9" : "#e5e7eb",
                color: showOptimizeRecommend ? "#fff" : "#111",
                border: "none",
                padding: "8px 12px",
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {optimizeLabel}
            </button>

            <button
              onClick={() => setShowRouteMap((v) => !v)}
              title="Show Route Map"
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "#facc15",
                color: "#1e3a8a",
                fontWeight: 700,
                border: "none",
              }}
            >
              {showRouteMap ? "Hide Route Map" : "Show Route Map"}
            </button>

            <button onClick={exportCSV}>Export CSV</button>
          </div>
        )}

        {/* Itinerary list */}
        {data.itinerary[activeDay] && (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemsForDay} strategy={verticalListSortingStrategy}>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {data.itinerary[activeDay].activities.map((act, i) => {
                  const loc = act.location || {};
                  const w = act.weather;
                  const c = act.coordinates;
                  const prevC = data.itinerary[activeDay].activities[i - 1]?.coordinates;
                  const mode = prevC && c ? modeFor(distKm(prevC, c)) : undefined;

                  // only the previous→current segment for small card map
                  const daySegments = routesByDay[activeDay]?.segments || [];
                  const singleSeg = segmentForIndex(daySegments, i);

                  return (
                    <li key={`act-${i}`} style={{ marginBottom: 18 }}>
                      <SortableActivity id={`act-${i}`}>
                        <div className="card">
                          {/* LEFT */}
                          <div className="left">
                            <div className="title">
                              <b>{act.time || "Flexible"}</b> — {act.title}
                            </div>
  <div className="loc">
  <span style={{ marginRight: 6 }}>📍</span>
  <span className="flag">{flag(loc.country)} </span>
  {loc.name}

  {act.link && (
    <a
      href={act.link}
      target="_blank"
      rel="noopener noreferrer"
      title="Open website or Google Maps"
      style={{
        marginLeft: 6,
        textDecoration: "none",
        fontSize: 18,
        cursor: "pointer",
      }}
    >
      🌐
    </a>
  )}
</div>

                            {w && (
                              <a href={w.link} target="_blank" rel="noreferrer" className="weather">
                                🌤 {w.temp}°C — {w.description}
                              </a>
                            )}
                            {act.details && <div className="details">{act.details}</div>}
                            {act.cost_estimate && <div className="cost">💰 {act.cost_estimate}</div>}
                          </div>

                          {/* RIGHT */}
                          <div className="right">
                            {c && (
                              <div className="mapWrap">
                                <LeafletMap
                                  lat={c.lat}
                                  lon={c.lon}
                                  popup={loc.name}
                                  routes={singleSeg}
                                  user={userLocation} // show pin if accurate, but not routed
                                />
                              </div>
                            )}
                            {act.travelTime && mode && (
                              <div className="travelBadge">
                                {iconFor(mode)} {act.travelTime}
                              </div>
                            )}
                            {act.image && (
                              <img
                                src={act.image}
                                alt=""
                                onClick={() => setPopupImage(act.image)}
                                onError={(e) => (e.currentTarget.src = "/fallback.jpg")}
                                className="thumb"
                              />
                            )}
                          </div>
                        </div>
                      </SortableActivity>
                    </li>
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {/* Full-width route map below list */}
        {showRouteMap && data.itinerary[activeDay] && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 2px 6px rgba(0,0,0,.1)",
                padding: 10,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Full Day Route</div>
              <div style={{ width: "100%", height: "45vh" }}>
                <LeafletMap
                  lat={data.itinerary[activeDay].activities[0]?.coordinates?.lat || 1.29}
                  lon={data.itinerary[activeDay].activities[0]?.coordinates?.lon || 103.85}
                  popup={`Day ${activeDay + 1}`}
                  routes={routesByDay[activeDay]?.segments || []} // all segments for full-day map
                  bounds={fullDayBounds}
                  user={userLocation}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image modal */}
      {popupImage && (
        <div className="overlay" onClick={() => setPopupImage(null)}>
          <img className="modalImg" src={popupImage} alt="full" />
        </div>
      )}

      <style jsx>{`
.loc a {
  opacity: 0.85;
}
.loc a:hover {
  opacity: 1;
}
        .card {
          background: #fff;
          padding: 14px;
          border-radius: 10px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
          position: relative;
        }
        .title { font-size: 18px; }
        .loc { margin-top: 6px; font-size: 15px; color: #111827; }
        .flag { font-weight: 700; letter-spacing: 1px; }
        .weather { display: inline-block; margin-top: 6px; color: #0ea5e9; text-decoration: none; font-weight: 600; }
        .details { margin-top: 6px; color: #374151; }
        .cost { margin-top: 5px; color: #15803d; font-weight: 600; }

        .right { display: flex; flex-direction: column; gap: 8px; }
        .mapWrap { position: relative; z-index: 5 !important; overflow: hidden; border-radius: 8px; height: 150px; }
        .thumb { width: 100%; height: 135px; object-fit: cover; border-radius: 8px; cursor: zoom-in; background: #f9fafb; }
        .travelBadge { background: #1e3a8a; color: #fff; padding: 5px 12px; font-size: 14px; border-radius: 18px; width: fit-content; }

        /* Keep Leaflet controls clickable */
        :global(.leaflet-control-zoom){ position: relative; z-index: 99999 !important; pointer-events: auto !important; }
        :global(.leaflet-container){ pointer-events: auto !important; }
        :global(.leaflet-pane){ pointer-events: auto !important; z-index: 990 !important; }

        @media (max-width: 700px) { .card { grid-template-columns: 1fr; } }

        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 9999; cursor: zoom-out; }
        .modalImg { max-width: 92%; max-height: 92%; border-radius: 10px; }
      `}</style>
    </div>
  );
}
