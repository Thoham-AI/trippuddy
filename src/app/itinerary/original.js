"use client";

/**
 * TripPuddy — Full Destination Planner / Itinerary Builder page
 * Features:
 *  - Prompt box → calls /api/destinations (your rich backend)
 *  - Day list with draggable activities (dnd-kit)
 *  - Per-activity mini map with previous→current segment
 *  - Full-day route map toggle (polyline across all segments)
 *  - “Optimize day” (lightweight clustering + nearest neighbor)
 *  - Travel summaries (walk/drive min, total km)
 *  - Export CSV
 *  - Weather + image + website links, safe fallbacks
 */

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";

// Map (client only)
const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
});

// dnd-kit
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ----------------------- Draggable wrapper ----------------------- */
function SortableActivity({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/* ----------------------- numeric + geo helpers ----------------------- */

const R = 6371; // km
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
  mins < 1
    ? "Walking distance"
    : `${Math.round(mins)} min ${mode === "walk" ? "walk" : "by Taxi"}`;

const fallbackMinutes = (dKm, mode) =>
  mode === "walk" ? (dKm / 4) * 60 : (dKm / 30) * 60 + 3;

/* ----------------------- routing via ORS with safe fallbacks ----------------------- */

async function fetchRoute(prev, next) {
  if (!prev || !next) {
    return { mode: "walk", label: null, minutes: 0, coords: [], steps: [] };
  }

  const dKm = distKm(prev, next);
  const mode = modeFor(dKm);
  const key = process.env.NEXT_PUBLIC_ORS_KEY;

  // If no key → fallback estimate & straight line
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
      // graceful fallback
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
      // Rare parse issue from upstream — fallback
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

    const coords = coordsLonLat.map(([lon, lat]) => [lat, lon]); // convert to [lat, lon]
    const mins = secs ? secs / 60 : fallbackMinutes(dKm, mode);

    return {
      mode,
      label: minutesToStr(mins, mode),
      minutes: Math.round(mins),
      coords,
      steps,
    };
  } catch {
    // network exceptions → fallback
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

/**
 * Build all adjacent routes in a day & aggregate totals.
 * mutateTravelTime: when true, writes the route label into each activity.travelTime
 */
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
      latlngs: route.coords, // [[lat, lon], ...]
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

/* ----------------------- light "optimize" ordering ----------------------- */

/**
 * Mixed heuristic:
 *  - Cluster by proximity (<= ~0.9km)
 *  - Greedy nearest neighbor within clusters
 *  - Then order clusters by centroid proximity
 */
function mixedOptimizeActivities(activities) {
  if (!activities?.length) return activities;
  const THRESH = 0.9; // km

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

/* ----------------------- component ----------------------- */

export default function DestinationsPage() {
  // UI state
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  // Itinerary state
  const [data, setData] = useState({ itinerary: [], destinations: [] });
  const [activeDay, setActiveDay] = useState(0);

  // Route/geo
  const [routesByDay, setRoutesByDay] = useState({}); // { idx: { segments, totals } }
  const [showRouteMap, setShowRouteMap] = useState(false);

  // UX extras
  const [popupImage, setPopupImage] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [savingsByDay, setSavingsByDay] = useState({}); // { idx: minutesSaved }

  const inputRef = useRef(null);

  // Safe geolocation sampling (don’t use if too inaccurate)
  useEffect(() => {
    async function detectLocation() {
      // 1. Try browser GPS first
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;

          console.log("GPS location:", latitude, longitude);
          setUserLocation({ lat: latitude, lon: longitude });
        },
        async (err) => {
          console.warn("GPS failed:", err.message);

          // 2. Fallback → IP-based location
          try {
            const res = await fetch("https://ipapi.co/json/");
            const json = await res.json();

            if (json.latitude && json.longitude) {
              console.log("Using IP geolocation:", json);
              setUserLocation({ lat: json.latitude, lon: json.longitude });
            } else {
              throw new Error("No IP location data");
            }
          } catch (ipErr) {
            console.error("IP geolocation failed:", ipErr);

            // 3. Final fallback → center of Australia
            setUserLocation({ lat: -25.2744, lon: 133.7751 });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 5000,
        }
      );
    }

    detectLocation();
  }, []);

  /* ----------------------- fetch itinerary ----------------------- */

  const generate = async () => {
    if (!prompt.trim()) return;
    if (!userLocation) {
      console.log("Location not ready yet — using fallback if needed.");
    }

    setLoading(true);

    try {
      const { lat, lon } = userLocation || { lat: null, lon: null };

      const res = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: prompt, // <-- send user's real query!
          userLocation: { lat, lon }, // <-- real detected location
        }),
      });

      if (!res.ok) {
        setLoading(false);
        alert("Server error: itinerary generation failed.");
        return;
      }

      const json = await res.json();

      let activities = [];

      // Preferred new array backend
      if (Array.isArray(json.itinerary) && json.itinerary.length > 0) {
        const apiActivities = json.itinerary[0].activities || [];

        activities = apiActivities.map((a) => ({
          time: a.time || "Flexible",
          title: a.title || a.placeName || "Activity",
          details: a.details || a.description || "",
          cost_estimate:
            a.cost_estimate ||
            (a.approxCostAUD ? `Approx ${a.approxCostAUD} AUD` : ""),
          coordinates:
            a.coordinates ||
            a.coords ||
            (a.latitude && a.longitude
              ? { lat: a.latitude, lon: a.longitude }
              : null),
          location: a.location || {},
          // Use backend photo if provided, otherwise fallback to static map when we have lat/lon
          image:
            a.image ||
            (a.latitude && a.longitude
              ? `https://maps.googleapis.com/maps/api/staticmap?center=${a.latitude},${a.longitude}&zoom=15&size=600x400&markers=color:red%7C${a.latitude},${a.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_STATIC_KEY}`
              : null),
          link: a.link || null,
          weather: a.weather || null,
          travelTime: a.travelTime ?? null,
        }));

      // Modern backend shape: itinerary.days[] from /api/itineraries
      } else if (Array.isArray(json.itinerary?.days)) {
        const apiActivities = json.itinerary.days[0]?.activities || [];

        activities = apiActivities.map((a) => ({
          // main label that shows in the card title
          time:
            a.arrival_time ||
            a.time_of_day ||
            a.time ||
            "Flexible",

          // new time-specific fields
          arrival_time: a.arrival_time || null,
          durationMinutes: a.duration_minutes || null,
          departure_time: a.suggested_departure_time || null,
          distanceFromPreviousKm: a.distance_km_from_previous ?? null,
          travelTimeFromPreviousMinutes:
            a.travel_time_minutes_from_previous ?? null,

          title: a.title || "Activity",
          details: a.description || "",
          cost_estimate: a.estimated_cost
            ? `Approx ${a.estimated_cost} AUD`
            : "",

          coordinates:
            a.coordinates ||
            (a.latitude && a.longitude
              ? { lat: a.latitude, lon: a.longitude }
              : null),

          location: { name: a.title, country: "AU" },

          image:
            a.image ||
            (a.latitude && a.longitude
              ? `https://maps.googleapis.com/maps/api/staticmap?center=${a.latitude},${a.longitude}&zoom=15&size=600x400&markers=color:red%7C${a.latitude},${a.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_STATIC_KEY}`
              : null),

          // normalized weather from top-level json.weather
          weather: json.weather || null,
          weatherTemp: json.weather?.main?.temp ?? null,
          weatherDesc: json.weather?.weather?.[0]?.description ?? null,
          weatherIcon: json.weather?.weather?.[0]?.icon ?? null,
          weatherLink: json.weather?.id
            ? `https://openweathermap.org/city/${json.weather.id}`
            : null,

          travelTime: null,
        }));

      // Legacy backend shape: json.itinerary.itinerary.activities
      } else if (json.itinerary?.itinerary?.activities) {
        const apiActivities = json.itinerary.itinerary.activities;

        activities = apiActivities.map((a) => ({
          time: a.time || "Flexible",
          title: a.title || "Activity",
          details: a.description || "",
          cost_estimate: a.estimated_cost ? `Approx ${a.estimated_cost} AUD` : "",
          coordinates:
            a.coordinates ||
            (a.latitude && a.longitude
              ? { lat: a.latitude, lon: a.longitude }
              : null),
          location: { name: a.title, country: "AU" },
          image:
            a.image ||
            (a.latitude && a.longitude
              ? `https://maps.googleapis.com/maps/api/staticmap?center=${a.latitude},${a.longitude}&zoom=15&size=600x400&markers=color:red%7C${a.latitude},${a.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_STATIC_KEY}`
              : null),
          // normalized weather from top-level json.weather
          weather: json.weather || null,
          weatherTemp: json.weather?.main?.temp ?? null,
          weatherDesc: json.weather?.weather?.[0]?.description ?? null,
          weatherIcon: json.weather?.weather?.[0]?.icon ?? null,
          travelTime: null,
        }));

      // FALLBACK SHAPE
      } else {
        const slots = json.itinerary?.slots || json.slots || [];

        activities = slots.map((slot) => ({
          time: slot.time || "Flexible",
          title: slot.placeName || slot.title || "Activity",
          details: slot.description || "",
          cost_estimate: slot.approxCostAUD
            ? `Approx ${slot.approxCostAUD} AUD`
            : "",
          coordinates: slot.coordinates || null,
          location: slot.location || {},
          image:
            slot.image ||
            (slot.coordinates?.lat && slot.coordinates?.lon
              ? `https://maps.googleapis.com/maps/api/staticmap?center=${slot.coordinates.lat},${slot.coordinates.lon}&zoom=15&size=600x400&markers=color:red%7C${slot.coordinates.lat},${slot.coordinates.lon}&key=${process.env.NEXT_PUBLIC_GOOGLE_STATIC_KEY}`
              : null),
          link: slot.link || null,
          weather: slot.weather || null,
          travelTime: null,
        }));
      }

      const newItinerary = [
        {
          day: 1,
          activities,
        },
      ];

      // recompute travel times between stops
      for (const day of newItinerary) {
        const acts = day.activities || [];
        const tasks = acts.map(async (a, i) => {
          if (i === 0) {
            a.travelTime = null;
            return;
          }
          const prev = acts[i - 1]?.coordinates;
          const cur = a.coordinates;
          if (!prev || !cur) {
            a.travelTime = null;
            return;
          }
          const route = await fetchRoute(prev, cur);
          a.travelTime = route.label;
        });
        await Promise.all(tasks);
      }

      setData({ itinerary: newItinerary });
      setActiveDay(0);
      setShowRouteMap(false);

      await recomputeAll(newItinerary);

      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      console.error("Generate error:", err);
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------- recompute helpers ----------------------- */

  const recomputeDay = async (idx, itinerary) => {
    const day = itinerary[idx];
    const acts = Array.isArray(day?.activities) ? day.activities : [];
    if (!acts.length) {
      setRoutesByDay((prev) => ({ ...prev, [idx]: { segments: [], totals: null } }));
      setSavingsByDay((prev) => ({ ...prev, [idx]: 0 }));
      return;
    }

    const bundle = await buildRoutesAndTotals(acts);
    setRoutesByDay((prev) => ({ ...prev, [idx]: bundle }));

    // compute “savings if optimized”
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

  /* ----------------------- optimize active day ----------------------- */

  const optimizeActiveDay = async () => {
    const it = Array.isArray(data.itinerary) ? [...data.itinerary] : [];
    const acts = Array.isArray(it[activeDay]?.activities)
      ? it[activeDay].activities
      : [];
    if (acts.length < 3) return;
    const optimized = mixedOptimizeActivities(acts);
    it[activeDay] = { ...it[activeDay], activities: optimized };
    setData({ ...data, itinerary: it });
    await recomputeDay(activeDay, it);
  };

  /* ----------------------- CSV export ----------------------- */

  const exportCSV = () => {
    const rows = [
      ["Day", "Time", "Title", "Location", "Country", "Travel Time", "Weather", "Map Link"],
    ];
    (data.itinerary || []).forEach((day) =>
      (day.activities || []).forEach((act) => {
        const loc = act.location || {};
        const weather = act.weather
          ? `${act.weather?.temp}°C ${act.weather?.description}`
          : "";
        rows.push([
          day.day,
          act.time || "",
          act.title || "",
          `${loc.name || ""}${loc.city ? ", " + loc.city : ""}`,
          loc.country || "",
          act.travelTime || "",
          weather,
          act.link || "",
        ]);
      })
    );
    const csv = Papa.unparse(rows);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    link.download = "itinerary.csv";
    link.click();
  };

  /* ----------------------- UI helpers ----------------------- */

  const flag = (c) =>
    c
      ? c
          .toUpperCase()
          .split("")
          .map((x) => String.fromCodePoint(127397 + x.charCodeAt()))
          .join("")
      : "";

  const daySummary = (idx) => {
    const totals = routesByDay[idx]?.totals;
    const acts = data.itinerary[idx]?.activities || [];
    if (!totals || !acts.length) return null;
    const { totalKm, walkMin, driveMin } = totals;
    const parts = [];
    if (walkMin) parts.push(`🚶 ${walkMin}m`);
    if (driveMin) parts.push(`🚕 ${driveMin}m`);
    return `${totalKm.toFixed(1)} km travel · ${acts.length} stops${
      parts.length ? " — " + parts.join(" + ") : ""
    }`;
  };

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

  // Bounds to fit all activity markers on full-day map
  const fullDayBounds = useMemo(() => {
    const acts = data.itinerary[activeDay]?.activities || [];
    const pts = acts
      .map((a) => a.coordinates)
      .filter(Boolean)
      .map((c) => [c.lat, c.lon]);
    return pts.length ? pts : null;
  }, [data.itinerary, activeDay]);

  // Single-segment helper for the mini card maps
  const segmentForIndex = (segments, i) => {
    if (!segments || i <= 0) return [];
    const seg = segments[i - 1];
    return seg ? [seg] : [];
  };

  const savedMin = savingsByDay[activeDay] || 0;
  const showOptimizeRecommend = savedMin >= 8;
  const optimizeLabel = showOptimizeRecommend
    ? `Improve Route (save ${Math.round(savedMin)}m)`
    : `Optimize day`;

  /* ----------------------- render ----------------------- */

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Banner / hero */}
      <div
        style={{
          width: "100%",
          height: 140,
          overflow: "hidden",
          position: "relative",
          marginTop: "-2px",
        }}
      >
        <img
          src="/banner.jpg"
          alt="Banner"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.92) saturate(1.1)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,.25), rgba(0,0,0,0))",
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 24,
            textShadow: "0 3px 8px rgba(0,0,0,.35)",
          }}
        >
          Your TripPuddy Itinerary Planner 🗺️
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "20px auto", padding: "0 16px" }}>
        {/* Query box */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 14,
            boxShadow: "0 3px 10px rgba(0,0,0,.08)",
            padding: 16,
            marginTop: 24,
            display: "flex",
            gap: 12,
            alignItems: "center",
            border: "1px solid #e2e8f0",
          }}
        >
          <input
            ref={inputRef}
            placeholder="Describe your trip... e.g. 3 days Singapore food + culture, mid budget"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              outline: "none",
              fontSize: "1.05rem",
            }}
          />

          <button
            disabled={loading}
            onClick={generate}
            style={{
              background: "#0d9488",
              color: "#fff",
              padding: "14px 22px",
              borderRadius: 12,
              fontWeight: 700,
              border: "none",
              fontSize: "1rem",
              minWidth: 130,
            }}
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>

        {/* Days header / controls */}
        {data.itinerary?.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 22,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {data.itinerary.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveDay(i);
                    setShowRouteMap(false);
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: activeDay === i ? "#1e3a8a" : "#e2e8f0",
                    color: activeDay === i ? "#fff" : "#1e293b",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                  }}
                >
                  Day {i + 1}
                </button>
              ))}
            </div>

            <div
              style={{ marginLeft: "auto", fontWeight: 700, color: "#334155" }}
            >
              📅 {daySummary(activeDay)}
            </div>

            <button
              onClick={optimizeActiveDay}
              style={{
                background: showOptimizeRecommend ? "#0ea5e9" : "#e2e8f0",
                color: showOptimizeRecommend ? "#fff" : "#1e293b",
                border: "none",
                padding: "9px 14px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              {optimizeLabel}
            </button>

            <button
              onClick={() => setShowRouteMap((v) => !v)}
              style={{
                background: "#facc15",
                color: "#1e3a8a",
                padding: "9px 14px",
                borderRadius: 10,
                fontWeight: 900,
                border: "none",
              }}
            >
              {showRouteMap ? "Hide Map" : "Show Map"}
            </button>

            <button
              onClick={() => exportCSV()}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                background: "#e2e8f0",
                color: "#1e293b",
                fontWeight: 700,
                border: "1px solid #cbd5e1",
              }}
            >
              Export CSV
            </button>

            {/* PDF export button */}
            {data.itinerary?.length > 0 && (
              <button
                onClick={async () => {
                  try {
                    setLoading(true);
                    const res = await fetch("/api/generatePdf", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ itinerary: data.itinerary }),
                    });
                    setLoading(false);

                    if (res.ok) {
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                    } else {
                      alert("PDF generation failed.");
                    }
                  } catch (err) {
                    console.error("Export PDF error:", err);
                    setLoading(false);
                    alert("Error creating PDF. Check console for details.");
                  }
                }}
                title="Export itinerary as PDF"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#0ea5e9",
                  color: "#fff",
                  fontWeight: 700,
                  border: "none",
                }}
              >
                🧾 Export PDF
              </button>
            )}
          </div>
        )}

        {/* Itinerary list (DnD) */}
        {data.itinerary?.[activeDay] && (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={itemsForDay}
              strategy={verticalListSortingStrategy}
            >
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  marginTop: 12,
                }}
              >
                {data.itinerary[activeDay].activities?.map((act, i) => {
                  const loc = act.location || {};
                  const w = act.weather;
                  const c = act.coordinates;
                  const prevC =
                    data.itinerary[activeDay].activities?.[i - 1]?.coordinates;
                  const mode = prevC && c ? modeFor(distKm(prevC, c)) : undefined;

                  const daySegments = routesByDay[activeDay]?.segments || [];
                  const singleSeg = segmentForIndex(daySegments, i);
return (
  <li key={`act-${i}`} style={{ marginBottom: 18 }}>
    <SortableActivity id={`act-${i}`}>
      <div
        className="card"
        style={{
          background: "#fff",
          padding: 14,
          borderRadius: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          position: "relative",
          border: "1px solid #eef2f7",
        }}
      >

        {/* ================= LEFT SIDE ================= */}
        <div className="left" style={{ display: "flex", flexDirection: "column" }}>

          {/* TITLE */}
          <div
            className="title"
            style={{ fontSize: 18, fontWeight: 700 }}
          >
            <b>{act.time || "Flexible"}</b> — {act.title}
          </div>

          {/* TIMING INFO */}
          {(act.arrival_time || act.durationMinutes || act.departure_time) && (
            <div
              className="timing"
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#4b5563",
                fontWeight: 500,
              }}
            >
              {act.arrival_time && <span>Arrive {act.arrival_time}</span>}
              {act.durationMinutes && (
                <span>
                  {act.arrival_time ? " · " : ""}
                  Stay ~{act.durationMinutes} min
                </span>
              )}
              {act.departure_time && (
                <span>
                  {(act.arrival_time || act.durationMinutes) ? " · " : ""}
                  Leave {act.departure_time}
                </span>
              )}
            </div>
          )}

          {/* LOCATION + FLAG + LINK */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            <span style={{ marginRight: 6 }}>📍</span>

            <span
              className="flag"
              style={{
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              {flag(loc.country)}{" "}
            </span>

            <span>{loc.name}</span>

            {act.link && (
              <a
                href={act.link}
                target="_blank"
                rel="noopener noreferrer"
                title="Open website or Google Maps"
                style={{
                  marginLeft: 8,
                  textDecoration: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  opacity: 0.9,
                }}
              >
                🌐
              </a>
            )}
          </div>

          {/* WEATHER */}
          {act.weatherTemp !== null && (
            <div
              className="weather"
              role={act.weatherLink ? "button" : undefined}
              onClick={() => {
                const link = act.weather?.link || act.weatherLink;
                if (link) window.open(link, "_blank");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
                color: "#0ea5e9",
                fontWeight: 700,
                cursor: act.weatherLink ? "pointer" : "default",
                textDecoration: act.weatherLink ? "underline" : "none",
              }}
            >
              <img
                src={`https://openweathermap.org/img/wn/${
                  act.weather?.icon || act.weatherIcon
                }@2x.png`}
                style={{ width: 32, height: 32 }}
              />

              <span>
                {Math.round(act.weather?.temp ?? act.weatherTemp)}°C —{" "}
                {act.weather?.description ?? act.weatherDesc}
              </span>
            </div>
          )}

          {/* DETAILS */}
          {act.details && (
            <div
              className="details"
              style={{
                marginTop: 8,
                color: "#374151",
              }}
            >
              {act.details}
            </div>
          )}

          {/* COST */}
          {act.cost_estimate && (
            <div
              className="cost"
              style={{
                marginTop: 6,
                color: "#15803d",
                fontWeight: 700,
              }}
            >
              💰 {act.cost_estimate}
            </div>
          )}

        </div>
        {/* ================= END LEFT SIDE ================= */}


        {/* ================= RIGHT SIDE ================= */}
        <div
          className="right"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >

          {/* ACTIVITY IMAGE */}
          {act.image && (
            <img
              src={act.image}
              alt={act.title}
              onClick={() => setPopupImage(act.image)}
              style={{
                width: "100%",
                height: 150,
                objectFit: "cover",
                borderRadius: 10,
                cursor: "zoom-in",
                boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
              }}
            />
          )}

          {/* MINI MAP */}
          {c && (
            <div
              className="mapWrap"
              style={{
                position: "relative",
                zIndex: 5,
                overflow: "hidden",
                borderRadius: 10,
                height: 160,
                outline: "1px solid #f0f2f6",
              }}
            >
              <LeafletMap
                lat={c.lat}
                lon={c.lon}
                popup={loc.name}
                routes={singleSeg}
                user={userLocation}
              />
            </div>
          )}

          {/* TRAVEL BADGE */}
          {act.travelTime && mode && (
            <div
              className="travelBadge"
              style={{
                background: "#1e3a8a",
                color: "#fff",
                padding: "6px 12px",
                fontSize: 14,
                borderRadius: 18,
                width: "fit-content",
                fontWeight: 800,
              }}
            >
              {iconFor(mode)} {act.travelTime}
            </div>
          )}

          {/* FULLSCREEN IMAGE POPUP */}
          {popupImage && (
            <div
              className="overlay"
              onClick={() => setPopupImage(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.85)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999,
                cursor: "zoom-out",
              }}
            >
              <img
                className="modalImg"
                src={popupImage}
                alt="full"
                style={{
                  maxWidth: "92%",
                  maxHeight: "92%",
                  borderRadius: "12px",
                  boxShadow: "0 0 24px rgba(0,0,0,0.4)",
                  transition: "transform 0.25s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "scale(1.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "scale(1.0)")
                }
              />
            </div>
          )}

        </div>
        {/* ================= END RIGHT SIDE ================= */}

      </div> {/* END card */}
    </SortableActivity>
  </li>
);
