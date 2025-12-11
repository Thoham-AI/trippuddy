"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BudgetSummary from "@/components/itinerary/BudgetSummary.js";
import TextModal from "@/components/itinerary/TextModal.js";
import TripMap from "@/components/itinerary/TripMap.js";

import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import ActivityCard from "@/components/itinerary/ActivityCard.js";
import DayHeaderControls from "@/components/itinerary/DayHeaderControls";
import PhotoModal from "@/components/itinerary/PhotoModal.js";
import FullDayRouteMap from "@/components/itinerary/FullDayRouteMap.js";

// Leaflet map (client only)
const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
});

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

/* ----------------------- routing via ORS ----------------------- */

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

    const coords = coordsLonLat.map(([lon, lat]) => [lat, lon]); // [lat, lon]
    const mins = secs ? secs / 60 : fallbackMinutes(dKm, mode);

    return {
      mode,
      label: minutesToStr(mins, mode),
      minutes: Math.round(mins),
      coords,
      steps,
    };
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

/* Build adjacent routes in a day & aggregate totals. */
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
      mode: route.mode,
      latlngs: route.coords,
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

/* ----------------------- main component ----------------------- */

export default function DestinationsPage() {

  const parseCost = (str) => {
    if (!str) return 0;
    const nums = (str.match(/\d+(\.\d+)?/g) || []).map(Number);
    if (!nums.length) return 0;
    if (nums.length === 1) return nums[0];
    const avg = (nums[0] + nums[1]) / 2;
    return avg;
  };

  const computeBudget = () => {
    if (!Array.isArray(data.itinerary)) return null;

    const perDay = data.itinerary.map((d) => {
      const total = (d.activities || []).reduce(
        (sum, a) => sum + parseCost(a.cost_estimate),
        0
      );
      return { day: d.day, total };
    });

    const total = perDay.reduce((s, d) => s + d.total, 0);
    return { perDay, total };
  };

  const [showTripMap, setShowTripMap] = useState(false);

  // budget + AI modals
  const [budgetBreakdown, setBudgetBreakdown] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");

  // for save/load
  const STORAGE_KEY = "trippuddy_itinerary_v1";

  // UI state
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  // Itinerary state
  const [data, setData] = useState({ itinerary: [] });
  const [activeDay, setActiveDay] = useState(0);

  // Routes / geo
  const [routesByDay, setRoutesByDay] = useState({});
  const [showRouteMap, setShowRouteMap] = useState(false);

  // UX extras
  const [popupImage, setPopupImage] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [savingsByDay, setSavingsByDay] = useState({});

  const inputRef = useRef(null);

  /* --------- safe geolocation (GPS → IP → AU centre) ---------- */

  useEffect(() => {
    function detectLocation() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lon: longitude });
        },
        async () => {
          try {
            const res = await fetch("https://ipapi.co/json/");
            const json = await res.json();
            if (json.latitude && json.longitude) {
              setUserLocation({ lat: json.latitude, lon: json.longitude });
            } else {
              throw new Error("No IP location data");
            }
          } catch {
            setUserLocation({ lat: -25.2744, lon: 133.7751 }); // centre of AU
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

    setLoading(true);
    try {
      const { lat, lon } = userLocation || { lat: null, lon: null };

      const res = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: prompt,
          userLocation: { lat, lon },
        }),
      });

      if (!res.ok) {
        setLoading(false);
        alert("Server error: itinerary generation failed.");
        return;
      }

      const json = await res.json();
      let activities = [];

      // 1) Preferred new array backend
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
          image:
            a.image ||
            (a.latitude && a.longitude
              ? `https://maps.googleapis.com/maps/api/staticmap?center=${a.latitude},${a.longitude}&zoom=15&size=600x400&markers=color:red%7C${a.latitude},${a.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_STATIC_KEY}`
              : null),
          link: a.link || null,
          weather: a.weather || null,
          travelTime: a.travelTime ?? null,
        }));

      // 2) Modern backend: itinerary.days[]
      } else if (Array.isArray(json.itinerary?.days)) {
        const apiActivities = json.itinerary.days[0]?.activities || [];

        activities = apiActivities.map((a) => ({
          time: a.arrival_time || a.time_of_day || a.time || "Flexible",
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
          weather: json.weather || null,
          weatherTemp: json.weather?.main?.temp ?? null,
          weatherDesc: json.weather?.weather?.[0]?.description ?? null,
          weatherIcon: json.weather?.weather?.[0]?.icon ?? null,
          weatherLink: json.weather?.id
            ? `https://openweathermap.org/city/${json.weather.id}`
            : null,
          travelTime: null,
        }));

      // 3) Legacy shape: itinerary.itinerary.activities
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
          weather: json.weather || null,
          weatherTemp: json.weather?.main?.temp ?? null,
          weatherDesc: json.weather?.weather?.[0]?.description ?? null,
          weatherIcon: json.weather?.weather?.[0]?.icon ?? null,
          travelTime: null,
        }));

      // 4) Fallback shape
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

      const newItinerary = [{ day: 1, activities }];

      // recompute travel times
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

  const fullDayBounds = useMemo(() => {
    const acts = data.itinerary[activeDay]?.activities || [];
    const pts = acts
      .map((a) => a.coordinates)
      .filter(Boolean)
      .map((c) => [c.lat, c.lon]);
    return pts.length ? pts : null;
  }, [data.itinerary, activeDay]);

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

  /* ----------------------- PDF export ----------------------- */

  const exportPdf = async () => {
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
  };

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

        {/* Day header & controls */}
        {data.itinerary?.length > 0 && (
          <DayHeaderControls
            itinerary={data.itinerary}
            activeDay={activeDay}
            setActiveDay={(i) => {
              setActiveDay(i);
              setShowRouteMap(false);
            }}
            daySummary={daySummary}
            optimizeActiveDay={optimizeActiveDay}
            optimizeLabel={optimizeLabel}
            showOptimizeRecommend={showOptimizeRecommend}
            showRouteMap={showRouteMap}
            toggleRouteMap={() => setShowRouteMap((v) => !v)}
            exportCSV={exportCSV}
            exportPdf={exportPdf}
          />
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
                  const c = act.coordinates;
                  const prevC =
                    data.itinerary[activeDay].activities?.[i - 1]?.coordinates;
                  const mode = prevC && c ? modeFor(distKm(prevC, c)) : undefined;

                  const daySegments = routesByDay[activeDay]?.segments || [];
                  const singleSeg = segmentForIndex(daySegments, i);

                  return (
                    <li key={`act-${i}`} style={{ marginBottom: 18 }}>
                      <SortableActivity id={`act-${i}`}>
                        <ActivityCard
                          act={act}
                          loc={loc}
                          mode={mode}
                          coordinates={c}
                          singleSeg={singleSeg}
                          LeafletMap={LeafletMap}
                          userLocation={userLocation}
                          flag={flag}
                          iconFor={iconFor}
                          setPopupImage={setPopupImage}
                        />
                      </SortableActivity>
                    </li>
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {/* Full-day route map */}
        {showRouteMap && data.itinerary?.[activeDay] && (
          <FullDayRouteMap
            dayIndex={activeDay}
            itinerary={data.itinerary}
            routesByDay={routesByDay}
            fullDayBounds={fullDayBounds}
            LeafletMap={LeafletMap}
            userLocation={userLocation}
          />
        )}
      </div>

      {/* global image popup */}
      <PhotoModal image={popupImage} onClose={() => setPopupImage(null)} />
    </div>
  );
}
