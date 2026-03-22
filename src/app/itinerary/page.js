"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BudgetSummary from "@/components/Itinerary/BudgetSummary.js";
import TextModal from "@/components/Itinerary/TextModal.js";
import TripMap from "@/components/Itinerary/TripMap.js";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import ActivityCard from "@/components/Itinerary/ActivityCard.js";
import DayHeaderControls from "@/components/Itinerary/DayHeaderControls";
import PhotoModal from "@/components/Itinerary/PhotoModal.js";
import FullDayRouteMap from "@/components/Itinerary/FullDayRouteMap.js";

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
  if (
    typeof a.lat !== "number" ||
    typeof a.lon !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lon !== "number"
  )
    return 0;

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

/* ----------------------- time sorting helpers ----------------------- */

function normalizeTimeToMinutes(act) {
  const raw =
    act?.arrival_time ||
    act?.time ||
    act?.time_of_day ||
    act?.departure_time ||
    "";

  if (!raw) return Number.POSITIVE_INFINITY;

  const s = String(raw).toLowerCase().trim();
  if (!s || s === "flexible") return Number.POSITIVE_INFINITY;

  // HH:mm or H:mm
  let m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) return h * 60 + min;
  }

  // 8am / 8 pm / 8:30am
  m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const ampm = m[3];
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    if (h >= 0 && h < 24 && min >= 0 && min < 60) return h * 60 + min;
  }

  // named buckets (fallbacks)
  if (s.includes("breakfast")) return 8 * 60;
  if (s.includes("morning")) return 9 * 60;
  if (s.includes("lunch")) return 12 * 60;
  if (s.includes("afternoon")) return 14 * 60;
  if (s.includes("dinner")) return 18 * 60;
  if (s.includes("evening") || s.includes("night")) return 19 * 60;

  return Number.POSITIVE_INFINITY;
}

function sortActivitiesByTime(activities) {
  if (!Array.isArray(activities)) return [];
  return activities
    .filter(Boolean)
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => {
      const tx = normalizeTimeToMinutes(x.a);
      const ty = normalizeTimeToMinutes(y.a);
      if (tx !== ty) return tx - ty;
      return x.idx - y.idx; // stable
    })
    .map((x) => x.a);
}

function normalizeLooseText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractTripCityFromPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return "";

  const plain = normalizeLooseText(text);
  const knownLocations = [
    ["flinders ranges", "Flinders Ranges"],
    ["flinders range", "Flinders Ranges"],
    ["nam dinh", "Nam Dinh"],
    ["ninh binh", "Ninh Binh"],
    ["hanoi", "Hanoi"],
    ["ha noi", "Hanoi"],
    ["ho chi minh", "Ho Chi Minh City"],
    ["saigon", "Ho Chi Minh City"],
    ["da nang", "Da Nang"],
    ["danang", "Da Nang"],
    ["hoi an", "Hoi An"],
  ];

  for (const [needle, city] of knownLocations) {
    if (plain.includes(needle)) return city;
  }

  const patterns = [
    /\b(?:in|to|at|visit|around)\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$)/iu,
    /^\s*\d+\s+days?(?:\s+in)?\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$|\s+)/iu,
    /\b(?:o|ở|tai|tại|den|đến|di|đi)\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$)/iu,
    /^\s*\d+\s+ngay\s+(?:o|ở|tai|tại)\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$|\s+)/iu,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }

  return "";
}

/* ----------------------- routing via ORS ----------------------- */

// ĐẢM BẢO ĐOẠN NÀY KHÔNG NẰM TRONG BẤT KỲ CẶP NGOẶC NHỌN { } CỦA HÀM KHÁC
async function fetchRoute(prev, next) {
  if (!prev?.lat || !prev?.lon || !next?.lat || !next?.lon) return fallback();

  try {
    const profile = modeFor(distKm(prev, next)) === "walk" ? "foot-walking" : "driving-car";
    
    // Gọi đến Proxy của chính mình thay vì gọi trực tiếp ra ngoài
    const res = await fetch("/api/route-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        coordinates: [[Number(prev.lon), Number(prev.lat)], [Number(next.lon), Number(next.lat)]]
      }),
    });

    const json = await res.json();
    const feat = json?.features?.[0];

    return {
      mode: profile === "foot-walking" ? "walk" : "drive",
      coords: feat?.geometry?.coordinates.map(([lon, lat]) => [lat, lon]) || [], // Đảo ngược để khớp Leaflet
      // ... các field khác giữ nguyên
    };
  } catch (err) {
    return fallback();
  }
}

/* Build adjacent routes in a day & aggregate totals. */
/* --- ĐÃ SỬA: Gọi fetchRoute để lấy tọa độ thật từ ORS --- */
async function buildRoutesAndTotals(activities) {
  const segments = [];
  let totalKm = 0;
  let totalMin = 0;

  if (!Array.isArray(activities) || activities.length < 2) {
    return { segments, totals: { totalKm: 0, totalMin: 0 } };
  }

  for (let i = 1; i < activities.length; i++) {
    const prev = activities[i - 1]?.coordinates;
    const next = activities[i]?.coordinates;
    
    if (prev && next) {
      // GỌI API THẬT Ở ĐÂY
      const routeData = await fetchRoute(prev, next); 
      
      // Cộng dồn tổng thời gian/quãng đường
      totalMin += routeData.minutes;
      const d = distKm(prev, next);
      totalKm += d;

      // Lưu segments để vẽ Polyline trên Map
      segments.push({
        mode: routeData.mode,
        latlngs: routeData.coords, // Tọa độ thật để vẽ đường cong trên bản đồ
        label: routeData.label,
      });

      // Cập nhật nhãn hiển thị cho ActivityCard
      activities[i].travelLabel = routeData.label;
      activities[i].travelMode = routeData.mode;
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
    if (!pts.length) return { lat: 0, lon: 0 };
    const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lon = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return { lat, lon };
  });

  const order = [0];
  const pool = Array.from({ length: orderedInClusters.length }, (_, i) => i).slice(
    1
  );
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const parseCost = (str) => {
    if (!str) return 0;
    const nums = (str.match(/\d+(\.\d+)?/g) || []).map(Number);
    if (!nums.length) return 0;
    if (nums.length === 1) return nums[0];
    return (nums[0] + nums[1]) / 2;
  };

  const [showTripMap, setShowTripMap] = useState(false);

  // budget + AI modals
  const [budgetBreakdown, setBudgetBreakdown] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");

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

  /* ----------------------- recompute helpers ----------------------- */

  const recomputeDay = async (idx, itinerary) => {
    const day = itinerary?.[idx];
    const acts = Array.isArray(day?.activities) ? day.activities : [];
    if (!acts.length) {
      setRoutesByDay((prev) => ({
        ...prev,
        [idx]: { segments: [], totals: null },
      }));
      setSavingsByDay((prev) => ({ ...prev, [idx]: 0 }));
      return;
    }

    const bundle = await buildRoutesAndTotals(acts, true);
    setRoutesByDay((prev) => ({ ...prev, [idx]: bundle }));

    const optimized = mixedOptimizeActivities(acts);
    const currentTotals = bundle.totals;

    // IMPORTANT: do NOT mutate travelTime when comparing
    const optBundle = await buildRoutesAndTotals([...optimized], false);

    const saved = Math.max(
      0,
      (currentTotals.totalMin || 0) - (optBundle.totals.totalMin || 0)
    );
    setSavingsByDay((prev) => ({ ...prev, [idx]: saved }));
  };

const recomputeAll = async (it) => {
    const arr = Array.isArray(it) ? it : (it?.itinerary || []);
    console.log("🚀 Bắt đầu tính toán lộ trình cho", arr.length, "ngày...");

    setRoutesByDay({});
    setSavingsByDay({});

    for (let i = 0; i < arr.length; i++) {
      try {
        await recomputeDay(i, arr);
        console.log(`✅ Đã tính xong lộ trình ngày ${i + 1}`);
      } catch (error) {
        console.error(`❌ Lỗi tại ngày ${i + 1}:`, error);
      }
    }

    setData(prev => ({ ...prev, itinerary: [...arr] }));
    console.log("🏁 Hoàn tất recomputeAll.");
  };

  /* ----------------------- robust itinerary extraction ----------------------- */

  const extractDaysFromResponse = (json) => {
    // Try a lot of shapes (this is what your old file effectively did) :contentReference[oaicite:1]{index=1}
    const candidates = [
      json?.itinerary,
      json?.data?.itinerary,
      json?.result?.itinerary,
      json?.itinerary?.days,
      json?.itinerary?.itinerary, // sometimes nested
      json?.plan,
      json?.days,
    ];

    for (const c of candidates) {
      if (Array.isArray(c)) return c;
      // object keyed by day: { day1: {...}, day2: {...} }
      if (c && typeof c === "object") {
        const vals = Object.values(c);
        if (vals.some((v) => v && Array.isArray(v.activities))) return vals;
      }
    }

    // sometimes: { itinerary: { activities: [...] } } or { activities: [...] }
    const acts =
      json?.itinerary?.activities ||
      json?.itinerary?.itinerary?.activities ||
      json?.activities ||
      json?.data?.activities;

    if (Array.isArray(acts)) return [{ day: 1, activities: acts }];

    return [];
  };

  const normalizeActivity = (a, defaultLocationName) => {
    const coords =
      a?.coordinates ||
      a?.coords ||
      (typeof a?.latitude === "number" && typeof a?.longitude === "number"
        ? { lat: a.latitude, lon: a.longitude }
        : null);

    const loc =
      typeof a?.location === "object" && a.location !== null
        ? a.location
        : {
            name:
              typeof a?.location === "string" && a.location.trim()
                ? a.location.trim()
                : defaultLocationName,
            city: "",
            country: "",
          };

    const title = a?.title || a?.activity || a?.placeName || "Activity";

    // Preserve whatever link fields backend provides (older/newer)
    const website = a?.website || a?.url || null;
    const mapsUrl = a?.mapsUrl || a?.mapUrl || a?.googleMapsUrl || null;
    const link = a?.link || website || mapsUrl || null;

    return {
      ...a,
      id: a?.id || Math.random().toString(36).slice(2, 10),
      time:
        a?.time ||
        a?.arrival_time ||
        a?.time_of_day ||
        a?.departure_time ||
        "Flexible",
      arrival_time: a?.arrival_time || null,
      time_of_day: a?.time_of_day || null,
      departure_time: a?.departure_time || a?.suggested_departure_time || null,

      title,
      activity: a?.activity || title,
      details: a?.details || a?.description || "",

      cost_estimate:
        a?.cost_estimate ||
        (a?.estimated_cost ? `Approx ${a.estimated_cost}` : ""),

      coordinates: coords,
      location: loc,

      image: a?.image || null,

      website,
      mapsUrl,
      link,

      // travelTime will be computed later
      travelTime: a?.travelTime ?? null,
    };
  };

  /* ----------------------- fetch itinerary ----------------------- */

  const generate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const { lat, lon } = userLocation || { lat: null, lon: null };
      const tripCity = extractTripCityFromPrompt(prompt);

      setRoutesByDay({});
      setSavingsByDay({});
      setData({ itinerary: [] });

      const res = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: prompt,
          tripCity,
          userLocation: { lat, lon },
        }),
      });

      // IMPORTANT: backend might return text or json
      const rawText = await res.text();
      let json;
      try {
        json = JSON.parse(rawText);
      } catch {
        // try extract JSON blob inside text
        const m = rawText.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("Server did not return valid JSON.");
        json = JSON.parse(m[0]);
      }

      const daysRaw = extractDaysFromResponse(json);

      if (!Array.isArray(daysRaw) || daysRaw.length === 0) {
        console.error("Itinerary response shape not recognized:", json);
        alert(
          "AI không tạo được lịch trình. Boss thử nhập yêu cầu cụ thể hơn nhé!"
        );
        return;
      }

      const defaultLocationName =
        extractTripCityFromPrompt(prompt) || String(prompt.split(",")[0] || "").trim();

      const newItinerary = daysRaw.map((d, idx) => {
        const activitiesRaw = Array.isArray(d?.activities)
          ? d.activities
          : Array.isArray(d)
          ? d
          : [];

        const normalized = activitiesRaw.map((a) =>
          normalizeActivity(a, defaultLocationName)
        );

        // ✅ enforce chronological order once
        const sorted = sortActivitiesByTime(normalized);

        return {
          ...d,
          day: d?.day ?? idx + 1,
          activities: sorted,
        };
      });

      setData({ itinerary: newItinerary });
      setActiveDay(0);
      setShowRouteMap(false);

      // compute routes & travel times
      await recomputeAll(newItinerary);

      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      console.error("Generate error:", err);
      alert("Network / parsing error. Check console for details.");
    } finally {
      setLoading(false);
    }
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
        const loc =
          typeof act.location === "object" && act.location !== null
            ? act.location
            : { name: String(act.location || ""), city: "", country: "" };

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

  const daySummary = (idx) => {
    const totals = routesByDay[idx]?.totals;
    const acts = data.itinerary?.[idx]?.activities || [];
    if (!totals || !acts.length) return null;

    const { totalKm, walkMin, driveMin } = totals;
    const parts = [];
    if (walkMin) parts.push(`🚶 ${walkMin}m`);
    if (driveMin) parts.push(`🚕 ${driveMin}m`);

    return `${Number(totalKm || 0).toFixed(1)} km travel · ${acts.length} stops${
      parts.length ? " — " + parts.join(" + ") : ""
    }`;
  };

  const itemsForDay = useMemo(
    () =>
      data.itinerary?.[activeDay]?.activities?.map((_, i) => `act-${i}`) || [],
    [data.itinerary, activeDay]
  );

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const it = Array.isArray(data.itinerary) ? [...data.itinerary] : [];
    if (!it[activeDay] || !Array.isArray(it[activeDay].activities)) return;

    const acts = it[activeDay].activities;
    const from = Number(String(active.id).split("-")[1]);
    const to = Number(String(over.id).split("-")[1]);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;

    it[activeDay].activities = arrayMove(acts, from, to);
    setData({ ...data, itinerary: it });
    await recomputeDay(activeDay, it);
  };

  const fullDayBounds = useMemo(() => {
    const acts = data.itinerary?.[activeDay]?.activities || [];
    const pts = acts
      .map((a) => a.coordinates)
      .filter(Boolean)
      .map((c) => [c.lat, c.lon])
      .filter(([lat, lon]) => typeof lat === "number" && typeof lon === "number");
    return pts.length ? pts : null;
  }, [data.itinerary, activeDay]);

  const segmentForIndex = (segments, i) => {
    if (!Array.isArray(segments) || i <= 0) return [];
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
  // --- Updated return block: Fixed Prompt Box & Added "Menu" text ---
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", position: "relative" }}>
      
      {/* 1. NAVBAR - This part is usually in layout.js, but if you put it here, keep it clean */}
      {/* (Note: If your Navbar.js is already working, you can remove this <nav> block) */}

      {/* 2. HERO BANNER */}
      <div style={{ width: "100%", height: 160, overflow: "hidden", position: "relative" }}>
        <img
          src="/banner.jpg"
          alt="Banner"
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7)" }}
        />
        <div style={{ position: "absolute", bottom: 35, left: "50%", transform: "translateX(-50%)", color: "#ffffff", fontWeight: 800, fontSize: "1.6rem", textAlign: "center", width: "90%", textShadow: "2px 2px 10px rgba(0,0,0,0.8)" }}>
          Your Itinerary Planner 🗺️
        </div>
      </div>

      {/* 3. MAIN CONTENT AREA */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 10 }}>
        
        {/* PROMPT BOX - RE-ADDED HERE */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            padding: 20,
            marginTop: -35, // Floats the box over the banner
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column", // Stack on mobile
            gap: 12
          }}
          className="md:flex-row" // Side-by-side on desktop
        >
          <input
            ref={inputRef}
            placeholder="Where to? (e.g. 3 days in Sapa food tour)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            style={{
              flex: 1,
              padding: "16px 20px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              outline: "none",
              fontSize: "1rem",
              color: "#1e293b"
            }}
          />
          <button
            disabled={loading}
            onClick={generate}
            style={{
              backgroundColor: "#0d9488",
              color: "#ffffff",
              fontWeight: "bold",
              padding: "16px 30px",
              borderRadius: "12px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "1rem",
              transition: "all 0.2s"
            }}
          >
            {loading ? "Generating..." : "Generate Plan"}
          </button>
        </div>

        {/* 4. ITINERARY RESULTS */}
        {data.itinerary?.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <DayHeaderControls
              itinerary={data.itinerary}
              activeDay={activeDay}
              setActiveDay={(i) => {
                setActiveDay(i);
                setShowRouteMap(false);
              }}
              daySummary={daySummary(activeDay)}
              optimizeActiveDay={optimizeActiveDay}
              optimizeLabel={optimizeLabel}
              showOptimizeRecommend={showOptimizeRecommend}
              showRouteMap={showRouteMap}
              toggleRouteMap={() => setShowRouteMap((v) => !v)}
              exportCSV={exportCSV}
              exportPdf={exportPdf}
            />

            {data.itinerary?.[activeDay] && (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={itemsForDay} strategy={verticalListSortingStrategy}>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, marginTop: 15 }}>
                    {data.itinerary[activeDay].activities?.map((act, i) => {
                      const loc = typeof act.location === "object" && act.location !== null
                        ? act.location
                        : { name: String(act.location || ""), city: "", country: "" };
                      
                      const c = act.coordinates;
                      const prevC = data.itinerary[activeDay].activities?.[i - 1]?.coordinates;
                      const mode = prevC && c ? modeFor(distKm(prevC, c)) : undefined;

                      return (
                        <li key={`act-${act.id || i}`} style={{ marginBottom: 20 }}>
                          <SortableActivity id={`act-${i}`}>
                            <ActivityCard
                              act={act}
                              loc={loc}
                              mode={mode}
                              coordinates={c}
                              LeafletMap={LeafletMap}
                              userLocation={userLocation}
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

            {showRouteMap && (
              <FullDayRouteMap
                dayIndex={activeDay}
                itinerary={data.itinerary}
                routesByDay={routesByDay}
                LeafletMap={LeafletMap}
                userLocation={userLocation}
              />
            )}
          </div>
        )}
      </div>

      <PhotoModal image={popupImage} onClose={() => setPopupImage(null)} />
    </div>
  );
}