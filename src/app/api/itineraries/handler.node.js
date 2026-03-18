// src/app/api/itineraries/handler.node.js
// SAFE server-only execution — no build-time side effects

/* ---------------------------------------------------------------
   DYNAMIC IMPORT: avoids Vercel bundling failures
---------------------------------------------------------------*/
// Thêm import này ở đầu file handler.node.js
import clientPromise from "@/lib/mongodb"; 

async function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const OpenAI = (await import("openai")).default;
  return new OpenAI({ apiKey: key });
}

/* ---------------------------------------------------------------
   CONSTANTS
---------------------------------------------------------------*/
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_MAX_TOKENS = 5000;

const DEFAULT_LOCATION = {
  lat: 21.0285,
  lon: 105.8542,
};

const MAX_DAYS = 14;
const MAX_ACTIVITIES_PER_DAY = 10;

const FETCH_TIMEOUT_MS = 9000;

/* ---------------------------------------------------------------
   SAFE FETCH
---------------------------------------------------------------*/
async function safeFetch(url, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": process.env.OSM_USER_AGENT || "travel-ai-app",
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/* ---------------------------------------------------------------
   GOOGLE KEY
---------------------------------------------------------------*/
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

/* ---------------------------------------------------------------
   GEO HELPERS (NEW)
---------------------------------------------------------------*/
const EARTH_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

function distKm(a, b) {
  if (!a || !b) return 0;
  const lat1 = Number(a.lat);
  const lon1 = Number(a.lon);
  const lat2 = Number(b.lat);
  const lon2 = Number(b.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

async function geocodeCenter(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(
    q
  )}`;

  const res = await safeFetch(url, 8000);
  if (!res || !res.ok) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const top = Array.isArray(data) ? data[0] : null;
  if (!top) return null;

  const lat = Number(top.lat);
  const lon = Number(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon, display_name: top.display_name || null };
}

/* ---------------------------------------------------------------
   CITY RESOLUTION
---------------------------------------------------------------*/
function normalizeCityName(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z\s-]/g, "");
}

function cityMatches(a, b) {
  const A = normalizeCityName(a);
  const B = normalizeCityName(b);
  if (!A || !B) return false;
  if (A === B) return true;
  if (A.startsWith(B) || B.startsWith(A)) return true;
  return false;
}

async function reverseGeocodeCity(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return "";
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`;

  const res = await safeFetch(url, 8000);
  if (!res || !res.ok) return "";

  let data;
  try {
    data = await res.json();
  } catch {
    return "";
  }

  const addr = data?.address || {};
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.state ||
    addr.region ||
    addr.province ||
    ""
  );
}

/* ---------------------------------------------------------------
   DESTINATION / AUDIENCE HELPERS
---------------------------------------------------------------*/
function cleanCityPhrase(s) {
  if (!s) return "";
  let v = String(s)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "");

  const stopWords = new Set([
    "culture",
    "food",
    "culinary",
    "itinerary",
    "trip",
    "travel",
    "guide",
    "plan",
    "plans",
    "beach",
    "adventure",
    "relax",
    "relaxing",
    "shopping",
    "nature",
    "history",
    "historic",
    "with",
    "for",
    "and",
    "in",
  ]);

  const parts = v.split(" ").filter(Boolean);
  const kept = [];
  for (const w of parts) {
    const lw = w.toLowerCase();
    if (stopWords.has(lw)) break;
    kept.push(w);
    if (kept.length >= 3) break;
  }
  v = kept.join(" ").trim();
  return v;
}

function promptIndicatesKidsOrElderly(userPrompt) {
  const p = String(userPrompt || "").toLowerCase();
  const kid = /\b(kid|kids|child|children|family|baby|toddler)\b/.test(p);
  const old = /\b(elderly|senior|old|grandparent|grandparents|retiree)\b/.test(p);
  return kid || old;
}

function promptRequiresNight(userPrompt) {
  const p = String(userPrompt || "").toLowerCase();
  return /\b(night|nightlife|bar|club|pub|late|after dark|evening market|night market)\b/.test(
    p
  );
}

function minutesFromHHMM(hhmm) {
  return parseHHMM(hhmm);
}

function setArrival(a, mins) {
  if (!a) return;
  a.arrival_time = fmtHHMM(mins);
}

function isLunchActivity(a) {
  const title = String(a?.title || "").toLowerCase();
  const desc = String(a?.description || "").toLowerCase();
  const mins = parseHHMM(a?.arrival_time);
  const type = String(a?.type || "").toLowerCase();

  if (type === "meal") {
    if (
      title.includes("lunch") ||
      title.includes("bữa trưa") ||
      title.includes("ăn trưa") ||
      desc.includes("lunch") ||
      desc.includes("bữa trưa") ||
      desc.includes("ăn trưa")
    ) {
      return true;
    }
  }

  if (
    title.includes("lunch") ||
    title.includes("bữa trưa") ||
    title.includes("ăn trưa")
  ) {
    return true;
  }

  // Generic eatery/restaurant around lunch time => count as lunch
  if (
    mins != null &&
    mins >= 11 * 60 &&
    mins <= 14 * 60 &&
    (
      title.includes("eatery") ||
      title.includes("restaurant") ||
      title.includes("quán ăn") ||
      title.includes("nhà hàng")
    )
  ) {
    return true;
  }

  return false;
}

function isDinnerActivity(a) {
  const title = String(a?.title || "").toLowerCase();
  const desc = String(a?.description || "").toLowerCase();
  const mins = parseHHMM(a?.arrival_time);
  const type = String(a?.type || "").toLowerCase();

  if (type === "meal") {
    if (
      title.includes("dinner") ||
      title.includes("bữa tối") ||
      title.includes("ăn tối") ||
      desc.includes("dinner") ||
      desc.includes("bữa tối") ||
      desc.includes("ăn tối")
    ) {
      return true;
    }
  }

  if (
    title.includes("dinner") ||
    title.includes("bữa tối") ||
    title.includes("ăn tối")
  ) {
    return true;
  }

  if (
    mins != null &&
    mins >= 17 * 60 + 30 &&
    mins <= 20 * 60 &&
    (
      title.includes("eatery") ||
      title.includes("restaurant") ||
      title.includes("quán ăn") ||
      title.includes("nhà hàng")
    )
  ) {
    return true;
  }

  return false;
}

function ensureMealSlotsPerDay(days, tripCity, userPrompt) {
  const avoidNight = promptIndicatesKidsOrElderly(userPrompt) && !promptRequiresNight(userPrompt);

  for (const day of days || []) {
    if (!Array.isArray(day.activities)) day.activities = [];
    const acts = day.activities;

    // 1. Kiểm tra sự tồn tại của các bữa ăn (Dùng Regex bao quát hơn)
    const hasBreakfast = acts.some(x => /breakfast|coffee|cafe|café|ăn sáng/i.test(x.title));
    const hasLunch = acts.some(isLunchActivity);
    const hasDinner = acts.some(isDinnerActivity);
    const hasNight = acts.some(x => /night|evening|stroll|đêm/i.test(x.title));

    const city = tripCity || "the city";

    // 2. Thêm bữa sáng (Thêm vào ĐẦU ngày - dùng unshift)
    if (!hasBreakfast) {
      acts.unshift({
        title: `Breakfast & Coffee in ${city}`,
        arrival_time: "08:00",
        duration_minutes: 60,
        description: "Enjoy local breakfast and famous Vietnamese coffee.",
        type: "meal",
      });
    }

    // 3. Thêm bữa trưa (Nếu chưa có bất kỳ hoạt động ăn uống nào tầm giữa ngày)
    if (!hasLunch) {
      acts.push({
        title: "Lunch at a nearby local restaurant",
        arrival_time: "12:30",
        duration_minutes: 75,
        description: "Taste authentic local specialties for lunch.",
        type: "meal",
      });
    }

    // 4. Thêm bữa tối
    if (!hasDinner) {
      acts.push({
        title: `Dinner in ${city}`,
        arrival_time: "18:30",
        duration_minutes: 90,
        description: "Wind down with a delicious dinner at a highly-rated local spot.",
        type: "meal",
      });
    }

    // 5. Hoạt động buổi tối
    if (!avoidNight && !hasNight) {
      acts.push({
        title: `Evening stroll in ${city}`,
        arrival_time: "20:30",
        duration_minutes: 75,
        description: "Experience the local atmosphere at night.",
      });
    }
  }
}

/* --- FIXED: LUNCH DURATION & CLAMPING --- */
function enforceLunchBefore(days, latestMins) {
  for (const day of days || []) {
    if (!Array.isArray(day.activities)) continue;
    const acts = day.activities;

    for (const a of acts) {
      const t = String(a?.title || "").toLowerCase();
      if (t.includes("lunch") || t.includes("dinner") || a.type === "meal") {
        if (a.duration_minutes > 90) a.duration_minutes = 90;
      }

      if (!t.includes("lunch")) continue;

      const mins = minutesFromHHMM(a.arrival_time);
      if (mins == null) {
        setArrival(a, Math.min(12 * 60 + 30, latestMins));
        continue;
      }

      if (mins > latestMins) {
        setArrival(a, 12 * 60 + 30);
      }
    }
  }
}

function sortActivitiesByTime(days) {
  for (const day of days || []) {
    if (!Array.isArray(day.activities)) continue;
    day.activities.sort((a, b) => {
      const am = minutesFromHHMM(a?.arrival_time) ?? 1e9;
      const bm = minutesFromHHMM(b?.arrival_time) ?? 1e9;
      if (am !== bm) return am - bm;
      return String(a?.title || "").localeCompare(String(b?.title || ""));
    });
  }
}

async function fillMissingActivitiesBetweenMeals(days, tripCity = "", tripCenter = null) {
  if (!Array.isArray(days)) return;

  function getLatLon(a) {
    const lat = Number(a?.latitude ?? a?.lat ?? a?.coordinates?.lat);
    const lon = Number(a?.longitude ?? a?.lon ?? a?.coordinates?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  function isMealActivity(a) {
    const t = String(a?.title || "").toLowerCase();
    const type = String(a?.type || "").toLowerCase();
    return (
      type === "meal" ||
      t.includes("breakfast") ||
      t.includes("coffee") ||
      t.includes("brunch") ||
      t.includes("lunch") ||
      t.includes("dinner") ||
      t.includes("ăn sáng") ||
      t.includes("bữa sáng") ||
      t.includes("ăn trưa") ||
      t.includes("bữa trưa") ||
      t.includes("ăn tối") ||
      t.includes("bữa tối")
    );
  }

  function isLunchActivity(a) {
    const t = String(a?.title || "").toLowerCase();
    const d = String(a?.description || "").toLowerCase();
    const mins = parseHHMM(a?.arrival_time);
    const type = String(a?.type || "").toLowerCase();

    if (type === "meal" && (t.includes("lunch") || d.includes("lunch") || t.includes("ăn trưa") || t.includes("bữa trưa"))) {
      return true;
    }

    if (t.includes("lunch") || t.includes("ăn trưa") || t.includes("bữa trưa")) return true;

    return mins != null &&
      mins >= 11 * 60 &&
      mins <= 14 * 60 &&
      (t.includes("restaurant") || t.includes("eatery") || t.includes("nhà hàng") || t.includes("quán ăn"));
  }

  function buildRealStopCandidates(prev, next, gapMinutes) {
    const prevTitle = String(prev?.title || "").toLowerCase();
    const nextTitle = String(next?.title || "").toLowerCase();

    const candidates = [];

    // Ưu tiên stop giữa breakfast và lunch
    if (isMealActivity(prev) && isLunchActivity(next)) {
      candidates.push(
        {
          title: `Scenic viewpoint near ${tripCity || "the route"}`,
          type: "sightseeing",
          description: "Stop at a real scenic viewpoint or landmark on the way before lunch.",
          duration_minutes: 60,
        },
        {
          title: `Local cultural village in ${tripCity || "the area"}`,
          type: "sightseeing",
          description: "Visit a real village or cultural stop before lunch.",
          duration_minutes: 60,
        },
        {
          title: `Landmark in ${tripCity || "the area"}`,
          type: "sightseeing",
          description: "Visit a real landmark or photo stop before lunch.",
          duration_minutes: 45,
        }
      );
    }

    // Nếu là đoạn route scenic
    if (
      prevTitle.includes("pass") ||
      prevTitle.includes("mountain") ||
      prevTitle.includes("flag") ||
      prevTitle.includes("viewpoint") ||
      prevTitle.includes("đèo") ||
      prevTitle.includes("núi") ||
      prevTitle.includes("cột cờ")
    ) {
      candidates.push(
        {
          title: `Scenic stop near ${prev.title || tripCity || "the area"}`,
          type: "sightseeing",
          description: "A real scenic stop or viewpoint near the previous attraction.",
          duration_minutes: 45,
        },
        {
          title: `Photo viewpoint near ${prev.title || tripCity || "the area"}`,
          type: "sightseeing",
          description: "A real viewpoint or roadside panorama stop.",
          duration_minutes: 45,
        }
      );
    }

    // Fallback chung nhưng vẫn phải resolve ra place thật, không dùng trực tiếp
    candidates.push(
      {
        title: `Viewpoint in ${tripCity || "the area"}`,
        type: "sightseeing",
        description: "A real scenic viewpoint along the route.",
        duration_minutes: 45,
      },
      {
        title: `Tourist attraction in ${tripCity || "the area"}`,
        type: "sightseeing",
        description: "A real attraction along the route.",
        duration_minutes: 60,
      },
      {
        title: `Cultural stop in ${tripCity || "the area"}`,
        type: "sightseeing",
        description: "A real cultural stop along the route.",
        duration_minutes: 45,
      }
    );

    return candidates;
  }

  for (const day of days) {
    if (!Array.isArray(day.activities) || day.activities.length < 2) continue;

    const acts = [...day.activities];
    const rebuilt = [];
    const seenResolve = {
      usedPlaceIds: new Set(),
      lastPlacePoint: null,
      lastPlaceName: "",
    };

    // Khởi tạo seenResolve từ activity đầu tiên nếu có tọa độ
    const firstPoint = getLatLon(acts[0]);
    if (firstPoint) {
      seenResolve.lastPlacePoint = firstPoint;
      seenResolve.lastPlaceName = acts[0]?.title || "";
    }

    for (let i = 0; i < acts.length; i++) {
      const current = acts[i];
      rebuilt.push(current);

      const next = acts[i + 1];
      if (!next) continue;

      const currentTime = parseHHMM(current?.arrival_time);
      const nextTime = parseHHMM(next?.arrival_time);

      if (currentTime == null || nextTime == null) continue;

      const currentDur = Number.isFinite(Number(current?.duration_minutes))
        ? Number(current.duration_minutes)
        : 75;

      const currentEnd = currentTime + currentDur;
      const gap = nextTime - currentEnd;

      // Chỉ chèn khi trống quá nhiều thời gian
      if (gap < 90) continue;

      // Không chèn thêm nếu ngày đã khá đầy
      if (rebuilt.length >= 5) continue;

      const prevPoint = getLatLon(current);
      if (prevPoint) {
        seenResolve.lastPlacePoint = prevPoint;
        seenResolve.lastPlaceName = current?.title || seenResolve.lastPlaceName;
      }

      const candidates = buildRealStopCandidates(current, next, gap);

      let inserted = null;

      for (const candidate of candidates) {
        const resolved = await resolvePlace(candidate, tripCity, tripCenter, seenResolve);
        if (!resolved?.lat || !resolved?.lon) continue;

        const insertedTime = currentEnd + 30;
        const latestAllowed = nextTime - 45;
        if (insertedTime >= latestAllowed) continue;

        inserted = {
          title: resolved.name || candidate.title,
          arrival_time: fmtHHMM(insertedTime),
          duration_minutes: candidate.duration_minutes || 45,
          description: candidate.description,
          type: candidate.type || "sightseeing",
          placeId: resolved.placeId || null,
          latitude: Number(resolved.lat),
          longitude: Number(resolved.lon),
          coordinates: {
            lat: Number(resolved.lat),
            lon: Number(resolved.lon),
          },
          mapsUrl: resolved.mapsUrl || null,
          website: resolved.mapsUrl || null,
        };

        break;
      }

      if (inserted) {
        rebuilt.push(inserted);

        // cập nhật seen để bữa trưa / stop sau bám tiếp theo route
        seenResolve.lastPlacePoint = {
          lat: Number(inserted.latitude),
          lon: Number(inserted.longitude),
        };
        seenResolve.lastPlaceName = inserted.title || seenResolve.lastPlaceName;
        if (inserted.placeId) seenResolve.usedPlaceIds.add(inserted.placeId);
      }
    }

    day.activities = rebuilt;
  }
}

/* ---------------------------------------------------------------
   DESTINATION HINT
---------------------------------------------------------------*/
function normalizeLooseText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function extractDestinationHint(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") return "";
  const text = userPrompt.trim();
  const plain = normalizeLooseText(text);

  const knownLocations = [
    ["flinders ranges", "Flinders Ranges"],
    ["flinders range", "Flinders Ranges"],
    ["nam dinh", "Nam Dinh"],
    ["ninh binh", "Ninh Binh"],
    ["ha giang", "Ha Giang"],
    ["dong van", "Dong Van"],
    ["hanoi", "Hanoi"],
    ["ha noi", "Hanoi"],
    ["ho chi minh", "Ho Chi Minh City"],
    ["saigon", "Ho Chi Minh City"],
    ["da nang", "Da Nang"],
    ["danang", "Da Nang"],
    ["hoi an", "Hoi An"],
    ["singapore", "Singapore"],
    ["tokyo", "Tokyo"],
    ["osaka", "Osaka"],
    ["bangkok", "Bangkok"],
    ["kuala lumpur", "Kuala Lumpur"],
  ];

  for (const [needle, city] of knownLocations) {
    if (plain.includes(needle)) return city;
  }

  const patterns = [
    /(?:in|to|at|visit|around)\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$)/iu,
    /^\s*\d+\s+days?(?:\s+in)?\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$|\s+)/iu,
    /(?:o|ở|tai|tại|den|đến|di|đi)\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$)/iu,
    /^\s*\d+\s+ngay\s+(?:o|ở|tai|tại)\s+([\p{L}][\p{L}\s'’-]{1,60})(?:[,.]|$|\s+)/iu,
  ];

  for (const rePat of patterns) {
    const m = text.match(rePat);
    if (m?.[1]) return cleanCityPhrase(m[1]);
  }

  return "";
}

/* ---------------------------------------------------------------
   SEASONAL CLOSURE EXAMPLE
---------------------------------------------------------------*/
function isMindilLikelyClosedNow() {
  const m = new Date().getMonth() + 1;
  return m === 11 || m === 12 || m === 1 || m === 2 || m === 3;
}

/* ---------------------------------------------------------------
   TIME HELPERS
---------------------------------------------------------------*/
function parseHHMM(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function fmtHHMM(totalMinutes) {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function addDaysToUTCDate(d, days) {
  const nd = new Date(d.getTime());
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}

/* ---------------------------------------------------------------
   GOOGLE PLACES DETAILS
---------------------------------------------------------------*/
async function googlePlaceDetails(placeId, apiKey) {
  if (!placeId || !apiKey) return null;

  const detailURL =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}` +
    `&fields=name,geometry,formatted_address,photos,url,website,opening_hours,utc_offset_minutes,business_status` +
    `&key=${apiKey}`;

  const res = await safeFetch(detailURL, 9000);
  if (!res || !res.ok) return null;

  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const r = json?.result;
  if (!r) return null;

  return {
    placeId,
    name: r.name || null,
    address: r.formatted_address || null,
    lat: r.geometry?.location?.lat ?? null,
    lon: r.geometry?.location?.lng ?? null,
    mapsUrl: r.url || null,
    website: r.website || null,
    utcOffsetMinutes:
      typeof r.utc_offset_minutes === "number" ? r.utc_offset_minutes : null,
    openingPeriods: Array.isArray(r.opening_hours?.periods)
      ? r.opening_hours.periods
      : null,
    businessStatus: r.business_status || null,
  };
}

function hhmmToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string" || hhmm.length < 3) return null;
  const hh = Number(hhmm.slice(0, 2));
  const mm = Number(hhmm.slice(2, 4));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function buildIntervalsForWeekday(periods, weekday) {
  if (!Array.isArray(periods)) return [];
  const intervals = [];

  for (const p of periods) {
    const o = p?.open;
    const c = p?.close;

    if (!o || typeof o.day !== "number" || !o.time) continue;
    if (o.day !== weekday) continue;

    const start = hhmmToMinutes(o.time);
    if (start == null) continue;

    if (!c || typeof c.day !== "number" || !c.time) {
      intervals.push({ start, end: 24 * 60 });
      continue;
    }

    const endBase = hhmmToMinutes(c.time);
    if (endBase == null) continue;

    let end = endBase;
    if (c.day !== weekday) {
      end = endBase + 24 * 60;
    }

    intervals.push({ start, end });
  }

  intervals.sort((a, b) => a.start - b.start);
  return intervals;
}

function isWithinAnyInterval(mins, intervals) {
  for (const it of intervals) {
    if (mins >= it.start && mins < it.end) return true;
  }
  return false;
}

function nextOpenMinute(mins, intervals) {
  for (const it of intervals) {
    if (mins <= it.start) return it.start;
    if (mins >= it.start && mins < it.end) return mins;
  }
  return intervals.length ? intervals[0].start : null;
}

/* ---------------------------------------------------------------
   OPENING HOURS NORMALIZATION
---------------------------------------------------------------*/
async function normalizeTimesToOpeningHours(days, tripCity) {
  const apiKey = getGoogleKey();
  if (!apiKey) return;

  let baseUTC = new Date();
  let baseOffset = null;

  outer: for (const day of days) {
    for (const a of day.activities || []) {
      if (!a?.placeId) continue;
      const d = await googlePlaceDetails(a.placeId, apiKey);
      if (d?.utcOffsetMinutes != null) {
        baseOffset = d.utcOffsetMinutes;
        break outer;
      }
    }
  }

  function weekdayForDayIndex(dayIndex) {
    const utc = addDaysToUTCDate(baseUTC, dayIndex);
    if (baseOffset == null) {
      return utc.getUTCDay();
    }
    const shifted = new Date(utc.getTime() + baseOffset * 60 * 1000);
    return shifted.getUTCDay();
  }

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    if (!Array.isArray(day.activities)) continue;

    for (const a of day.activities) {
      if (!a.arrival_time && a.time) a.arrival_time = a.time;
      if (!a.arrival_time) a.arrival_time = "09:00";
    }

    const weekday = weekdayForDayIndex(di);

    for (const a of day.activities) {
      if (!a?.placeId) continue;

      const details = await googlePlaceDetails(a.placeId, apiKey);
      if (!details) continue;

      if (!a.latitude && Number.isFinite(Number(details.lat)))
        a.latitude = Number(details.lat);
      if (!a.longitude && Number.isFinite(Number(details.lon)))
        a.longitude = Number(details.lon);
      if (
        !a.coordinates &&
        Number.isFinite(Number(a.latitude)) &&
        Number.isFinite(Number(a.longitude))
      ) {
        a.coordinates = { lat: Number(a.latitude), lon: Number(a.longitude) };
      }

      if (!a.website) {
        if (details.website) a.website = details.website;
        else if (details.mapsUrl) a.website = details.mapsUrl;
      }
      if (!a.mapsUrl && details.mapsUrl) a.mapsUrl = details.mapsUrl;

      if (!details.openingPeriods) continue;

      const intervals = buildIntervalsForWeekday(details.openingPeriods, weekday);
      if (!intervals.length) continue;

      const desired = parseHHMM(a.arrival_time);
      if (desired == null) continue;

      if (!isWithinAnyInterval(desired, intervals)) {
        const adjusted = nextOpenMinute(desired, intervals);
        if (adjusted != null) {
          a.arrival_time = fmtHHMM(adjusted);
          if (a.description && !String(a.description).includes("Adjusted")) {
            a.description = `${a.description} (Adjusted to opening hours.)`;
          }
        }
      }
    }

    let cursor = 8 * 60;
    for (let i = 0; i < day.activities.length; i++) {
      const a = day.activities[i];
      const start = parseHHMM(a.arrival_time) ?? cursor;
      const fixedStart = Math.max(start, cursor);
      a.arrival_time = fmtHHMM(fixedStart);

      const dur = Number.isFinite(Number(a.duration_minutes))
        ? Number(a.duration_minutes)
        : 75;

      cursor = fixedStart + dur + 15;
    }
  }
}

function enforceBreakfastFirst(days, requireBreakfast) {
  if (!requireBreakfast) return;

  for (const day of days) {
    if (!Array.isArray(day.activities) || day.activities.length === 0) continue;

    const idx = day.activities.findIndex((a) => {
      const t = (a?.title || "").toLowerCase();
      return (
        t.includes("breakfast") ||
        t.includes("brunch") ||
        t.includes("café") ||
        t.includes("cafe") ||
        t.includes("coffee")
      );
    });

    if (idx === -1) continue;

    const breakfast = day.activities.splice(idx, 1)[0];
    breakfast.arrival_time = "08:00";

    if (day.activities[0]) {
      const t0 = parseHHMM(day.activities[0].arrival_time);
      if (t0 != null && t0 < 9 * 60) {
        day.activities[0].arrival_time = "09:30";
      }
    }

    day.activities.unshift(breakfast);
  }
}

/* --- STRONGER LOCALITY RULES (UPDATED) --- */
function buildPrompt(prompt, destinationHint = "", requireBreakfast = false, userCity = "", tripCity = "") {
  return `
You are TripPuddy, an expert travel planner.

Rules:
- Detect the exact number of days from the user input.
- Output EXACTLY that many days.
- Plan 4-6 activities per day.
- Every activity must be a REAL place or a clearly defined real stop.
- Do NOT invent vague placeholder activities such as "explore nearby attractions", "free time", or "walk around".
- Assume the traveler starts Day 1 already in the trip city, waking up from accommodation there.
- NEVER include travel from the user's current location, home city, or GPS location to the destination city as part of the itinerary.
- Day 1 must begin inside the trip city itself, starting from accommodation in that city.
- ALL activities must stay inside the trip city / destination region requested by the user.
${tripCity ? `- Trip city: ${tripCity}.\n` : ``}${userCity ? `- User current city (from location): ${userCity}.\n` : ``}

Food rules:
- Include exactly 1 lunch per day between 12:00-13:30.
- Include exactly 1 dinner per day between 18:00-19:30.
- Do NOT create duplicate lunch or duplicate dinner.
- Use real places for meals whenever possible.
- If a remote area has no clearly known restaurant, use a nearby local eatery at that location.
- If no restaurant is available nearby, mention in the description that the traveler should prepare snacks or food in advance.
- Do NOT send the traveler back to the city center just for lunch or dinner.

Timing rules:
- Morning start should be between 08:00-09:30.
- Breakfast / coffee should be between 07:00-09:30.
- Museums / attractions usually after 09:00.
- Lunch should not happen immediately after breakfast unless the user explicitly wants a very light day.
- Each day should include at least one sightseeing / cultural / scenic stop between breakfast and lunch.
- Keep the route geographically logical and avoid backtracking.
- Prefer attractions that are near the previous stop or naturally along the route.
- If moving into a remote scenic area, keep the next stops near that area instead of returning to the city center.

Output rules:
- Return STRICT JSON only.
- No markdown.
- No commentary outside the JSON.
- Use this structure exactly:

{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "title": "",
          "arrival_time": "",
          "duration_minutes": 90,
          "description": "",
          "type": "sightseeing"
        }
      ]
    }
  ]
}

Type rules:
- Use "meal" for breakfast, lunch, dinner, coffee.
- Use "sightseeing" for viewpoints, landmarks, villages, museums, markets, nature stops.
- Use "evening" for nightlife, night market, evening walk, or night views.

${requireBreakfast ? `- The traveler is assumed to already be staying in ${tripCity || destinationHint || "the destination city"} at the start of Day 1, so the FIRST activity of Day 1 MUST be breakfast/brunch/coffee in that city between 08:00-09:30.\n` : ``}
${destinationHint ? `- ALL activities MUST be within ${destinationHint}. Do NOT include places outside ${destinationHint}.` : ""}

USER INPUT:
"${prompt}"
`;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000"; // Môi trường máy tính của Boss
}

function canonicalPlaceTitle(title = "") {
  let t = String(title || "").trim();
  t = t.replace(
    /^(explore|visit|discover|morning at|afternoon at|evening at|walk around|stroll through|stop by|take in|experience)\s+/i,
    ""
  );
  t = t.replace(/^the\s+/i, "").trim();
  t = t.replace(/(local|nearby|famous|beautiful|historic|popular|best|top)/gi, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function isGenericMealTitle(title = "") {
  return /(breakfast|lunch|dinner|brunch|coffee|cafe|café|restaurant|food)/i.test(
    String(title || "")
  );
}

function looksLikeSpecificPoi(title = "") {
  return /(pagoda|temple|museum|market|church|cathedral|tower|park|lake|beach|mountain|geopark|fort|palace|citadel|bridge|national park|pass|old town|old quarter|village|waterfall|cave|peak|viewpoint)/i.test(
    String(title || "")
  );
}

function mealSearchLabel(a) {
  const t = String(a?.title || "").toLowerCase();
  if (t.includes("breakfast")) return "breakfast";
  if (t.includes("lunch")) return "lunch";
  if (t.includes("dinner")) return "dinner";
  if (t.includes("coffee") || t.includes("cafe") || t.includes("café")) return "cafe";
  return "restaurant";
}

function titleWordsForMatching(title = "") {
  return canonicalPlaceTitle(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (w) =>
        ![
          "the",
          "at",
          "in",
          "near",
          "local",
          "visit",
          "explore",
          "discover",
          "morning",
          "afternoon",
          "evening",
          "take",
          "experience",
          "and",
          "of",
        ].includes(w)
    );
}

function buildGenericPlaceQueries(cleanTitle, destinationHint, a, anchorName = "") {
  const queries = [];
  const isMeal = isGenericMealTitle(cleanTitle);

  if (isMeal) {
    const meal = mealSearchLabel(a);
    if (anchorName) queries.push(`${meal} near ${anchorName}`.trim());
    if (destinationHint) queries.push(`${meal} near ${destinationHint}`.trim());
    if (destinationHint) queries.push(`${destinationHint} local restaurant`.trim());
    if (destinationHint) queries.push(`${destinationHint} cafe food`.trim());
  } else {
    if (cleanTitle && destinationHint) queries.push(`${cleanTitle} ${destinationHint}`.trim());
    if (cleanTitle && destinationHint) queries.push(`${cleanTitle} in ${destinationHint}`.trim());
    if (cleanTitle && destinationHint) queries.push(`${destinationHint} ${cleanTitle}`.trim());
    if (cleanTitle) queries.push(cleanTitle);

    const simplified = cleanTitle
      .replace(/(old town|old quarter|walking street|city center|downtown)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (simplified && simplified !== cleanTitle && destinationHint) {
      queries.push(`${simplified} ${destinationHint}`.trim());
      queries.push(`${destinationHint} ${simplified}`.trim());
    }
  }

  return [...new Set(queries.filter(Boolean))];
}
function isGenericMealFallback(a) {
  const t = String(a?.title || "").toLowerCase();
  return (
    a?.type === "meal" &&
    (
      t.includes("local restaurant") ||
      t.includes("local eatery") ||
      t.includes("nearby restaurant") ||
      t.includes("nearby local restaurant") ||
      t.includes("breakfast in ") ||
      t.includes("lunch at ") ||
      t.includes("dinner in ")
    )
  );
}

function buildNearbyRestaurantQueries(a, anchorName = "", destinationHint = "") {
  const meal = mealSearchLabel(a);
  const queries = [];

  if (anchorName) queries.push(`${meal} near ${anchorName}`);
  if (anchorName) queries.push(`restaurant near ${anchorName}`);

  // chỉ dùng destinationHint như fallback nhẹ, không phải ưu tiên đầu
  if (!anchorName && destinationHint) queries.push(`${meal} in ${destinationHint}`);

  return [...new Set(queries.filter(Boolean))];
}

/**
 * Resolves location data (lat/lon) by checking MongoDB cache first, 
 * then falling back to Google Places API via our proxy.
 * * @param {Object} a - Activity object
 * @param {string} destinationHint - The general city or area
 * @param {Object} tripCenter - Fallback coordinates if no previous point exists
 * @param {Object} seen - State object to track used IDs and last coordinates
 */
/**
 * Resolved version of resolvePlace with internal scoring logic included.
 * Fixes the "calculateInternalScore is not defined" error.
 */
function buildLatLonMapUrl(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
  return `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lon)}`;
}

function applyAnchorLocationToMeal(activity, anchorPoint, anchorName = "") {
  if (!anchorPoint) return activity;

  const lat = Number(anchorPoint.lat);
  const lon = Number(anchorPoint.lon);

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    activity.latitude = lat;
    activity.longitude = lon;
    activity.coordinates = { lat, lon };
    activity.mapsUrl = buildLatLonMapUrl(lat, lon);
    activity.website = activity.mapsUrl;
    activity.placeId = null;
  }

  if (anchorName && !activity.description?.toLowerCase().includes("near this attraction")) {
    activity.description =
      `${activity.description || "Enjoy a meal nearby."} Near ${anchorName}. If no restaurant is available nearby, prepare snacks in advance.`;
  }

  return activity;
}

async function resolvePlace(a, destinationHint = "", tripCenter = null, seen = null) {
  try {
    const rawTitle = String(a?.title || "attraction").trim();
    const cleanTitle = canonicalPlaceTitle(rawTitle);
    const plainDestination = String(destinationHint || "").trim();

    const usedPlaceIds =
      seen && seen.usedPlaceIds instanceof Set ? seen.usedPlaceIds : new Set();

    const anchorPoint =
      seen?.lastPlacePoint?.lat && seen?.lastPlacePoint?.lon
        ? seen.lastPlacePoint
        : tripCenter;

    const anchorName = String(seen?.lastPlaceName || "").trim();
    const genericMeal = isGenericMealFallback(a);

    // Generic meal should cache by anchor, not just by city,
    // otherwise "Lunch at a nearby local restaurant in Ha Giang"
    // will keep reusing a city-center restaurant.
    const cacheKey = genericMeal
      ? `${cleanTitle} near ${anchorName || `${anchorPoint?.lat || ""},${anchorPoint?.lon || ""}`}`.toLowerCase().trim()
      : `${cleanTitle} in ${plainDestination}`.toLowerCase().trim();

    // 1. DATABASE CHECK
    const client = await clientPromise;
    const db = client.db("trippuddy");
    const cachedData = await db.collection("places").findOne({ query: cacheKey });

    if (cachedData) {
      console.log(`[Place Cache Hit]: ${cacheKey}`);
      const p = cachedData.data;

      if (seen && p?.lat && p?.lon) {
        if (!seen.usedPlaceIds) seen.usedPlaceIds = new Set();
        if (p.placeId) seen.usedPlaceIds.add(p.placeId);
        seen.lastPlacePoint = { lat: p.lat, lon: p.lon };
        seen.lastPlaceName = p.name || cleanTitle;
      }

      return p;
    }

    // 2. GOOGLE API SEARCH
    const baseUrl = getBaseUrl();

    const queries = genericMeal
      ? buildNearbyRestaurantQueries(a, anchorName, plainDestination)
      : buildGenericPlaceQueries(cleanTitle, plainDestination, a, anchorName);

    for (const q of queries) {
      const input = encodeURIComponent(q);
      let url = `${baseUrl}/api/google-proxy?input=${input}`;

      // Always bias search around previous attraction / last resolved point
      if (anchorPoint?.lat && anchorPoint?.lon) {
        url += `&location=${anchorPoint.lat},${anchorPoint.lon}&radius=30000`;
      }

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;

      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) continue;

      const scored = results
        .map((result) => {
          const lat = Number(result?.geometry?.location?.lat);
          const lon = Number(result?.geometry?.location?.lng);
          const point =
            Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;

          let score = 0;
          const name = String(result?.name || "").toLowerCase();
          const target = cleanTitle.toLowerCase();

          if (!genericMeal && name.includes(target)) score += 50;
          if (usedPlaceIds.has(result.place_id)) score -= 100;

          const dist = anchorPoint && point ? distKm(anchorPoint, point) : 0;
          score -= dist; // closer is better

          // For generic meal fallback, strongly prefer nearby results
          if (genericMeal) {
            if (dist <= 3) score += 40;
            else if (dist <= 10) score += 20;
            else if (dist <= 20) score += 5;
            else score -= 30;

            if (name.includes("restaurant") || name.includes("eatery") || name.includes("cafe")) {
              score += 10;
            }
          }

          return { result, point, distance: dist, score };
        })
        .filter((x) => x.point)
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      if (best) {
        // IMPORTANT:
        // If this is a generic meal fallback and the best result is still too far,
        // do NOT snap back to a city-center restaurant.
        if (genericMeal && best.distance > 30) {
          continue;
        }

        const picked = best.result;
        const pickedName = String(picked?.name || "").trim().toLowerCase();
        const pickedAddress = String(picked?.formatted_address || "").trim().toLowerCase();

        // Extra safety for generic meal:
        // avoid results that look like they belong to the city center when we already
        // have an anchor point from the previous attraction.
        if (
          genericMeal &&
          anchorName &&
          best.distance > 15 &&
          (
            pickedAddress.includes(String(plainDestination || "").toLowerCase()) ||
            pickedName.includes(String(plainDestination || "").toLowerCase())
          )
        ) {
          continue;
        }

        const placeResult = {
          placeId: picked?.place_id || null,
          lat: best.point.lat,
          lon: best.point.lon,
          name: picked?.name || null,
          address: picked?.formatted_address || null,

          // Google Text Search usually does NOT return picked.url reliably,
          // so prefer a stable place_id-based Maps URL.
          mapsUrl: picked?.place_id
            ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${picked.place_id}`
            : (
                Number.isFinite(Number(best.point.lat)) && Number.isFinite(Number(best.point.lon))
                  ? `https://www.google.com/maps/search/?api=1&query=${Number(best.point.lat)},${Number(best.point.lon)}`
                  : null
              ),

          // Keep website usable in UI even if no official website exists.
          website: picked?.website || (
            picked?.place_id
              ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${picked.place_id}`
              : (
                  Number.isFinite(Number(best.point.lat)) && Number.isFinite(Number(best.point.lon))
                    ? `https://www.google.com/maps/search/?api=1&query=${Number(best.point.lat)},${Number(best.point.lon)}`
                    : null
                )
          ),
        };

        // 4. SAVE TO DB
        await db.collection("places").updateOne(
          { query: cacheKey },
          { $set: { data: placeResult, createdAt: new Date() } },
          { upsert: true }
        );

        if (seen) {
          if (placeResult.placeId) usedPlaceIds.add(placeResult.placeId);
          seen.usedPlaceIds = usedPlaceIds;
          seen.lastPlacePoint = { lat: placeResult.lat, lon: placeResult.lon };
          seen.lastPlaceName = placeResult.name || cleanTitle;
        }

        console.log(`[Place Cache Miss]: ${cacheKey} saved to DB.`);
        return placeResult;
      }
    }

    // 5. HARD FALLBACK FOR GENERIC MEAL:
    // use previous attraction location for map/weather,
    // never fall back to a city-center restaurant.
    if (genericMeal && anchorPoint?.lat && anchorPoint?.lon) {
      const fallbackResult = {
        placeId: null,
        lat: Number(anchorPoint.lat),
        lon: Number(anchorPoint.lon),
        name: anchorName || cleanTitle,
        address: null,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${Number(anchorPoint.lat)},${Number(anchorPoint.lon)}`,
      };

      if (seen) {
        seen.usedPlaceIds = usedPlaceIds;
        // keep lastPlacePoint as-is
        if (!seen.lastPlacePoint) {
          seen.lastPlacePoint = { lat: fallbackResult.lat, lon: fallbackResult.lon };
        }
        if (!seen.lastPlaceName) {
          seen.lastPlaceName = fallbackResult.name || cleanTitle;
        }
      }

      return fallbackResult;
    }

    return null;
  } catch (err) {
    console.error("🔥 resolvePlace error:", err);
    return null;
  }
}

/**
 * Resolves a photo URL for an activity by calling the internal image API.
 * The internal API handles MongoDB caching and Unsplash integration.
 * * @param {Object} a - The activity object containing title and other details.
 * @param {string} destinationHint - The general area or city for better search context.
 * @param {Object} place - Optional place object (kept for signature compatibility).
 * @param {Object} seen - Optional state to track used assets (kept for signature compatibility).
 * @returns {Promise<string>} The resolved image URL.
 */
async function resolvePhoto(a, destinationHint = "", place = null, seen = null) {
  try {
    const baseUrl = getBaseUrl();
    const title = String(a?.title || "").trim();
    const destination = String(destinationHint || "").trim();

    const query = `${title} ${destination}`.trim();

    // Prefer place-aware lookup if we already resolved a place
    const imageUrl = place?.placeId
      ? `${baseUrl}/api/images?placeId=${encodeURIComponent(place.placeId)}&q=${encodeURIComponent(query)}`
      : `${baseUrl}/api/images?q=${encodeURIComponent(query)}`;

    const res = await fetch(imageUrl, { cache: "no-store" });
    if (!res.ok) return null;

    const json = await res.json();

    const url =
      json?.images?.[0]?.url ||
      json?.url ||
      json?.image ||
      null;

    if (!url) return null;

    // avoid repeating same image too often
    if (seen?.usedImageUrls instanceof Set) {
      if (seen.usedImageUrls.has(url)) return url;
      seen.usedImageUrls.add(url);
    }

    return url;
  } catch (err) {
    console.error("resolvePhoto error:", err);
    return null;
  }
}

/* ---------------------------------------------------------------
   LOCALITY GUARD (NEW): prevent Hanoi/HCMC drift for small cities
---------------------------------------------------------------*/
function isMealActivity(a) {
  const t = String(a?.title || "").toLowerCase();
  return (
    a?.type === "meal" ||
    t.includes("breakfast") ||
    t.includes("brunch") ||
    t.includes("lunch") ||
    t.includes("dinner") ||
    t.includes("restaurant") ||
    t.includes("cafe") ||
    t.includes("café") ||
    t.includes("coffee") ||
    t.includes("phở") ||
    t.includes("pho")
  );
}

function mealLabel(a) {
  const t = String(a?.title || "").toLowerCase();
  if (t.includes("breakfast") || t.includes("brunch") || t.includes("coffee") || t.includes("cafe") || t.includes("café"))
    return "Breakfast";
  if (t.includes("lunch")) return "Lunch";
  if (t.includes("dinner")) return "Dinner";
  return "Meal";
}

function clearPlaceFields(a) {
  a.image = null;
  a.placeId = null;
  a.latitude = null;
  a.longitude = null;
  a.coordinates = null;
  a.website = null;
  a.mapsUrl = null;
}

function enforceLocality(days, tripCenter, tripCity, maxKm = 200) {
  if (!tripCenter || !Number.isFinite(tripCenter.lat) || !Number.isFinite(tripCenter.lon)) return;

  for (const day of days || []) {
    for (const a of day.activities || []) {
      if (!a?.coordinates) continue;

      const d = distKm(tripCenter, a.coordinates);
      if (d <= maxKm) continue;

      // If it's a meal and it drifted far (usually Hanoi/HCMC), rewrite & reset
      if (isMealActivity(a)) {
        const label = mealLabel(a);
        a.title = `${label} at a local restaurant in ${tripCity || "the trip city"}`;
        a.description =
          (a.description ? String(a.description) + " " : "") +
          `(Adjusted: moved back to ${tripCity || "the trip city"} to avoid cross-city suggestions.)`;
        a.type = "meal";
        clearPlaceFields(a);
      } else {
        // For non-meals, keep title but remove wrong place data so UI won't route to another city
        a.description =
          (a.description ? String(a.description) + " " : "") +
          `(Note: original place appeared far from ${tripCity || "the trip city"}; clearing map link.)`;
        clearPlaceFields(a);
      }
    }
  }
}

/* ---------------------------------------------------------------
   MAIN HANDLER
---------------------------------------------------------------*/
export async function handleItineraryRequest(input) {
  try {
    if (!input || typeof input.userPrompt !== "string") {
      return { ok: false, error: "Invalid input" };
    }

    const userPrompt = input.userPrompt.trim();
    const userLocation = input.userLocation || DEFAULT_LOCATION;

    const explicitTripCity = String(input.tripCity || "").trim();
    const destinationHint = explicitTripCity || extractDestinationHint(userPrompt);

    const userCity = await reverseGeocodeCity(userLocation?.lat, userLocation?.lon);

    const promptLooksTravelSpecific =
      /\b(\d+\s*ngay|\d+\s*days?|o|ở|tai|tại|den|đến|du lich|du lịch|visit|trip|itinerary|travel|in|to)\b/i.test(
        normalizeLooseText(userPrompt)
      );

    const tripCity =
      explicitTripCity ||
      destinationHint ||
      (promptLooksTravelSpecific ? "" : userCity || "");

    // Center used to enforce locality
    const tripCenter = await geocodeCenter(tripCity);

    // Always start Day 1 from the destination city itself
    const requireBreakfast = true;

    const client = await getOpenAI();

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Return JSON only." },
        {
          role: "user",
          content: buildPrompt(
            userPrompt,
            destinationHint,
            requireBreakfast,
            userCity,
            tripCity
          ),
        },
      ],
      temperature: 0.5,
      max_tokens: OPENAI_MAX_TOKENS,
    });

    let raw = completion.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json|```/g, "").trim();

    let itinerary;
    try {
      itinerary = JSON.parse(raw);
    } catch {
      itinerary = { days: [] };
    }

    const days = Array.isArray(itinerary.days)
      ? itinerary.days.slice(0, MAX_DAYS)
      : [];

    ensureMealSlotsPerDay(days, tripCity, userPrompt);

    for (const day of days) {
      day.activities = Array.isArray(day.activities)
        ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY)
        : [];
    }

    enforceBreakfastFirst(days, requireBreakfast, tripCity);

    // -------------------- PASS 1: resolve place + photo --------------------
    for (const day of days) {
      const seenResolve = {
        usedImageUrls: new Set(),
        usedPlaceIds: new Set(),
        lastPlacePoint: null,
        lastPlaceName: "",
      };

      for (const a of day.activities || []) {
        if (!a?.title) continue;

        const place = await resolvePlace(
          a,
          tripCity || destinationHint,
          tripCenter,
          seenResolve
        );
        const photo = await resolvePhoto(
          a,
          tripCity || destinationHint,
          place,
          seenResolve
        );

        if (place) {
          a.placeId = place.placeId || null;
          a.latitude = Number.isFinite(Number(place.lat)) ? Number(place.lat) : null;
          a.longitude = Number.isFinite(Number(place.lon)) ? Number(place.lon) : null;
          a.coordinates =
            Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon))
              ? { lat: Number(place.lat), lon: Number(place.lon) }
              : null;
          a.mapsUrl = place.mapsUrl || null;
          a.website = place.website || place.mapsUrl || null;
        } else {
          a.placeId = null;
          a.latitude = null;
          a.longitude = null;
          a.coordinates = null;
          a.mapsUrl = null;
          a.website = null;
        }

        a.image = photo || a.image || null;
      }
    }

    // -------------------- PASS 2: re-resolve missing coords only --------------------
    for (const day of days) {
      const seenResolve = {
        usedImageUrls: new Set(),
        usedPlaceIds: new Set(),
        lastPlacePoint: null,
        lastPlaceName: "",
      };

      for (const a of day.activities || []) {
        if (!a?.title) continue;

        if (a.coordinates || a.placeId) {
          if (a.coordinates) {
            seenResolve.lastPlacePoint = {
              lat: Number(a.coordinates.lat),
              lon: Number(a.coordinates.lon),
            };
          }
          seenResolve.lastPlaceName = a.title || seenResolve.lastPlaceName;
          if (a.placeId) seenResolve.usedPlaceIds.add(a.placeId);
          if (a.image) seenResolve.usedImageUrls.add(a.image);
          continue;
        }

        const place = await resolvePlace(
          a,
          tripCity || destinationHint,
          tripCenter,
          seenResolve
        );
        const photo = await resolvePhoto(
          a,
          tripCity || destinationHint,
          place,
          seenResolve
        );

        if (place) {
          a.placeId = place.placeId || null;
          a.latitude = Number.isFinite(Number(place.lat)) ? Number(place.lat) : null;
          a.longitude = Number.isFinite(Number(place.lon)) ? Number(place.lon) : null;
          a.coordinates =
            Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon))
              ? { lat: Number(place.lat), lon: Number(place.lon) }
              : null;
          a.mapsUrl = place.mapsUrl || null;
          a.website = place.website || place.mapsUrl || null;
        } else {
          a.placeId = null;
          a.latitude = null;
          a.longitude = null;
          a.coordinates = null;
          a.mapsUrl = null;
          a.website = null;
        }

        if (!a.image) a.image = photo || null;
      }
    }

    // -------------------- TIME NORMALIZATION BEFORE GAP FILL --------------------
    await normalizeTimesToOpeningHours(days, tripCity);
    enforceLunchBefore(days, 13 * 60 + 30);
    sortActivitiesByTime(days);

    // -------------------- FILL LARGE GAPS WITH REAL STOPS ONLY --------------------
    await fillMissingActivitiesBetweenMeals(days, tripCity, tripCenter);
    sortActivitiesByTime(days);

    // -------------------- PASS 3: hydrate newly inserted activities --------------------
    for (const day of days) {
      const seenResolve = {
        usedImageUrls: new Set(),
        usedPlaceIds: new Set(),
        lastPlacePoint: null,
        lastPlaceName: "",
      };

      for (const a of day.activities || []) {
        if (!a?.title) continue;

        if (a.coordinates) {
          seenResolve.lastPlacePoint = {
            lat: Number(a.coordinates.lat),
            lon: Number(a.coordinates.lon),
          };
        }
        if (a.placeId) seenResolve.usedPlaceIds.add(a.placeId);
        if (a.image) seenResolve.usedImageUrls.add(a.image);
        seenResolve.lastPlaceName = a.title || seenResolve.lastPlaceName;

        // inserted activity may already have place, but still need image
        if (!a.placeId && !a.coordinates) {
          const place = await resolvePlace(
            a,
            tripCity || destinationHint,
            tripCenter,
            seenResolve
          );

          if (place) {
            a.placeId = place.placeId || null;
            a.latitude = Number.isFinite(Number(place.lat)) ? Number(place.lat) : null;
            a.longitude = Number.isFinite(Number(place.lon)) ? Number(place.lon) : null;
            a.coordinates =
              Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon))
                ? { lat: Number(place.lat), lon: Number(place.lon) }
                : null;
            a.mapsUrl = place.mapsUrl || null;
            a.website = place.website || place.mapsUrl || null;

            if (a.coordinates) {
              seenResolve.lastPlacePoint = {
                lat: Number(a.coordinates.lat),
                lon: Number(a.coordinates.lon),
              };
            }
            if (a.placeId) seenResolve.usedPlaceIds.add(a.placeId);
          }
        }

        if (!a.image) {
          const placeForPhoto =
            a.coordinates || a.placeId
              ? {
                  placeId: a.placeId || null,
                  lat: a.coordinates?.lat ?? a.latitude ?? null,
                  lon: a.coordinates?.lon ?? a.longitude ?? null,
                  mapsUrl: a.mapsUrl || null,
                }
              : null;

          const photo = await resolvePhoto(
            a,
            tripCity || destinationHint,
            placeForPhoto,
            seenResolve
          );

          if (photo) {
            a.image = photo;
            seenResolve.usedImageUrls.add(photo);
          }
        }
      }
    }

    // -------------------- FINAL LOCALITY + TIME CLEANUP --------------------
    enforceLocality(days, tripCenter, tripCity, 200);
    await normalizeTimesToOpeningHours(days, tripCity);
    enforceLunchBefore(days, 13 * 60 + 30);
    sortActivitiesByTime(days);

    return {
      ok: true,
      itinerary: { days },
      userLocation,
      tripCity,
      tripCenter,
    };
  } catch (err) {
    console.error("ITINERARY HANDLER ERROR:", err);
    return { ok: false, error: "Itinerary generation failed" };
  }
}