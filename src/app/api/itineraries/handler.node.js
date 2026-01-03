// src/app/api/itineraries/handler.node.js
// SAFE server-only execution — no build-time side effects

/* ---------------------------------------------------------------
   DYNAMIC IMPORT: avoids Vercel bundling failures
---------------------------------------------------------------*/
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
const MAX_ACTIVITIES_PER_DAY = 8;

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
   GOOGLE KEY (uses ANY of the env vars you already have)
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
   CITY RESOLUTION (OSM reverse geocode)
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
    addr.suburb ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    ""
  );
}

/* ---------------------------------------------------------------
   DESTINATION HINT (keep trip within one city)
---------------------------------------------------------------*/
function extractDestinationHint(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") return "";
  const text = userPrompt.trim();

  const inMatch = text.match(/\bin\s+([A-Za-z][A-Za-z\s-]{2,})(?:[,.]|$)/i);
  if (inMatch?.[1]) return inMatch[1].trim();

  const startMatch = text.match(
    /^([A-Za-z][A-Za-z\s-]{2,})(?:\s+\d+\s+day|\s+\d+\s+days|\s+day|\s+days)\b/i
  );
  if (startMatch?.[1]) return startMatch[1].trim();

  const p = text.toLowerCase();
  if (p.includes("singapore")) return "Singapore";
  if (p.includes("hanoi")) return "Hanoi";
  if (p.includes("ho chi minh") || p.includes("saigon"))
    return "Ho Chi Minh City";
  if (p.includes("darwin")) return "Darwin";
  if (p.includes("alice springs") || p.includes("alicesprings"))
    return "Alice Springs";
  if (p.includes("adelaide")) return "Adelaide";

  return "";
}

/* ---------------------------------------------------------------
   REQUESTED DAYS (NEW, DETERMINISTIC)
   Ensures we always return the same number of days the user asked for.
---------------------------------------------------------------*/
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function extractRequestedDays(userPrompt) {
  const s = String(userPrompt || "").toLowerCase();

  // common patterns: "2 days", "2 day", "2-day", "for 2 days"
  const m1 = s.match(/(?:^|\b)(\d{1,2})\s*[- ]*\s*day(?:s)?\b/);
  if (m1?.[1]) return clamp(parseInt(m1[1], 10), 1, MAX_DAYS);

  // if they say "weekend" etc, default to 1
  return 1;
}

/* ---------------------------------------------------------------
   SEASONAL CLOSURE EXAMPLE (Mindil)
---------------------------------------------------------------*/
function isMindilLikelyClosedNow() {
  const m = new Date().getMonth() + 1; // 1..12
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
   MEAL + EVENING ENFORCEMENT
---------------------------------------------------------------*/
const MEAL_WINDOWS = {
  lunch: { start: 11 * 60 + 30, end: 13 * 60 }, // 11:30–13:00
  dinner: { start: 18 * 60, end: 20 * 60 }, // 18:00–20:00
};

function titleHasAny(title, words) {
  const t = String(title || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

function isLunch(a) {
  return titleHasAny(a?.title, ["lunch"]);
}

function isDinner(a) {
  return titleHasAny(a?.title, ["dinner"]);
}

function isNightLike(a) {
  return titleHasAny(a?.title, [
    "night",
    "evening",
    "sunset",
    "night market",
    "market",
    "beer",
    "bar",
    "pub",
    "show",
    "puppet",
  ]);
}

function ensureDuration(a, fallback) {
  const d = Number(a?.duration_minutes);
  if (!Number.isFinite(d) || d <= 0) a.duration_minutes = fallback;
}

function clamp2(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dinnerTemplate(tripCity) {
  const c = String(tripCity || "").toLowerCase();
  if (c.includes("hanoi")) {
    return {
      title: "Dinner at Chả Cá Lã Vọng",
      description:
        "Enjoy Hanoi’s iconic turmeric fish with dill and noodles at a classic spot.",
    };
  }
  return {
    title: "Dinner at a local restaurant",
    description: "Enjoy a relaxed dinner at a well-reviewed local restaurant.",
  };
}

function nightTemplate(tripCity) {
  const c = String(tripCity || "").toLowerCase();
  if (c.includes("hanoi")) {
    return {
      title: "Evening walk + Water Puppet Show (Hoàn Kiếm area)",
      description:
        "A light evening activity: stroll around Hoàn Kiếm and catch a traditional water puppet performance.",
    };
  }
  return {
    title: "Evening activity (night market / scenic walk)",
    description:
      "A light evening activity to experience the city at night (market, riverside walk, or local show).",
  };
}

function enforceMealsAndNight(days, tripCity) {
  for (const day of days) {
    if (!Array.isArray(day.activities) || day.activities.length === 0) continue;

    for (const a of day.activities) {
      if (!a.arrival_time && a.time) a.arrival_time = a.time;
      if (!a.arrival_time) a.arrival_time = "09:00";
      ensureDuration(a, 75);
    }

    // LUNCH
    let lunchIdx = day.activities.findIndex(isLunch);
    if (lunchIdx === -1) {
      const lunch = {
        title: "Lunch at a local spot",
        arrival_time: "11:45",
        duration_minutes: 60,
        description: "Take a lunch break at a popular local eatery.",
      };
      const insertAt = Math.min(2, day.activities.length);
      day.activities.splice(insertAt, 0, lunch);
      lunchIdx = insertAt;
    } else {
      const lunch = day.activities[lunchIdx];
      const t = parseHHMM(lunch.arrival_time);
      if (t != null && t > MEAL_WINDOWS.lunch.end) {
        const idxBefore = day.activities.findIndex((a) => {
          const ta = parseHHMM(a.arrival_time);
          return ta != null && ta > MEAL_WINDOWS.lunch.end;
        });

        const moved = day.activities.splice(lunchIdx, 1)[0];
        moved.arrival_time = "11:45";

        if (idxBefore === -1) {
          const mid = Math.min(2, day.activities.length);
          day.activities.splice(mid, 0, moved);
        } else {
          day.activities.splice(Math.max(0, idxBefore - 1), 0, moved);
        }
      }
    }

    // DINNER
    if (!day.activities.some(isDinner)) {
      const d = dinnerTemplate(tripCity);
      day.activities.push({
        ...d,
        arrival_time: "18:30",
        duration_minutes: 70,
      });
    }

    // NIGHT
    if (!day.activities.some(isNightLike)) {
      const n = nightTemplate(tripCity);
      day.activities.push({
        ...n,
        arrival_time: "20:00",
        duration_minutes: 75,
      });
    }

    // Monotonic schedule pass
    let cursor = 8 * 60; // 08:00
    for (let i = 0; i < day.activities.length; i++) {
      const a = day.activities[i];
      ensureDuration(a, 75);

      const desired = parseHHMM(a.arrival_time);
      let start = desired == null ? cursor : Math.max(desired, cursor);

      if (isLunch(a)) {
        start = clamp2(start, MEAL_WINDOWS.lunch.start, MEAL_WINDOWS.lunch.end);
        start = Math.max(start, cursor);
        if (cursor > MEAL_WINDOWS.lunch.end) start = cursor;
      }

      if (isDinner(a)) {
        start = clamp2(start, MEAL_WINDOWS.dinner.start, MEAL_WINDOWS.dinner.end);
        start = Math.max(start, cursor);
        if (cursor > MEAL_WINDOWS.dinner.end) start = cursor;
      }

      a.arrival_time = fmtHHMM(start);
      cursor = start + Number(a.duration_minutes) + 15;
    }
  }
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

/* ---------------------------------------------------------------
   OPENING HOURS UTILITIES
---------------------------------------------------------------*/
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

      if (!a.latitude && Number.isFinite(Number(details.lat))) a.latitude = Number(details.lat);
      if (!a.longitude && Number.isFinite(Number(details.lon))) a.longitude = Number(details.lon);
      if (!a.coordinates && Number.isFinite(Number(a.latitude)) && Number.isFinite(Number(a.longitude))) {
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

/* ---------------------------------------------------------------
   BREAKFAST NORMALIZATION
---------------------------------------------------------------*/
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

/* ---------------------------------------------------------------
   GPT PROMPTS
---------------------------------------------------------------*/
function buildPrompt(prompt, destinationHint = "", requireBreakfast = false, userCity = "", tripCity = "") {
  return `
You are TripPuddy, an expert travel planner.

Rules:
- Detect number of days from user input
- Output EXACTLY that many days
- 4–6 activities per day
- Morning start (08:00–09:30)
- Real places only
${tripCity ? `- Trip city: ${tripCity}.\n` : ``}${userCity ? `- User current city (from location): ${userCity}.\n` : ``}
- Always include food in a realistic way:
  - Include breakfast (or coffee), lunch, and dinner as appropriate for a full day.
  - Lunch should be scheduled between 11:30–13:00.
  - Dinner should be scheduled between 18:00–20:00.
  - Include at least one evening/night activity (after dinner) for full-day itineraries.
${requireBreakfast ? `- Because the user is in the same city as the trip destination, the FIRST activity of EACH day MUST be a breakfast/brunch/coffee place suitable for 08:00–09:30.\n` : ``}
- Respect typical opening hours and common sense timing:
  - Breakfast: 08:00–10:00
  - Museums/attractions: usually after 09:00–10:00
  - Night markets: late afternoon/evening only
- Do NOT schedule a food place at an unrealistic time (e.g., "breakfast" after 10:30).
- ALL activities must be inside the trip city (no other cities).
${destinationHint ? `- ALL activities MUST be within ${destinationHint}. Do NOT include any place outside ${destinationHint}.` : ""}

Return STRICT JSON:

{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "title": "",
          "arrival_time": "",
          "duration_minutes": 90,
          "description": ""
        }
      ]
    }
  ]
}

USER INPUT:
"${prompt}"
`;
}

function buildMissingDaysPrompt(originalPrompt, tripCity, startDayNumber, endDayNumber) {
  return `
You are TripPuddy, an expert travel planner.

The user asked for a multi-day itinerary, but Day 1 was already generated.
Now generate ONLY the missing days.

Trip city: ${tripCity || "the destination city"}

Generate days ${startDayNumber} through ${endDayNumber} ONLY.
Do NOT include Day 1.

Rules:
- 4–6 activities per day
- Morning start (08:00–09:30)
- Real places only (within the trip city)
- Include food properly per day:
  - Lunch between 11:30–13:00
  - Dinner between 18:00–20:00
  - Include at least one evening/night activity after dinner

Return STRICT JSON:

{
  "days": [
    {
      "day": ${startDayNumber},
      "activities": [
        { "title": "", "arrival_time": "", "duration_minutes": 90, "description": "" }
      ]
    }
  ]
}

ORIGINAL USER INPUT:
"${originalPrompt}"
`;
}

/* ---------------------------------------------------------------
   ENSURE EXACT DAY COUNT (NEW)
---------------------------------------------------------------*/
async function generateMissingDaysIfNeeded({
  client,
  userPrompt,
  destinationHint,
  requireBreakfast,
  userCity,
  tripCity,
  days,
  requestedDays,
}) {
  const current = Array.isArray(days) ? days : [];
  if (requestedDays <= current.length) return current.slice(0, requestedDays);

  // Generate only the missing days
  const startDayNumber = current.length + 1;
  const endDayNumber = requestedDays;

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: "Return JSON only." },
      {
        role: "user",
        content: buildMissingDaysPrompt(userPrompt, tripCity || destinationHint, startDayNumber, endDayNumber),
      },
    ],
    temperature: 0.6,
    max_tokens: OPENAI_MAX_TOKENS,
  });

  let raw = completion.choices?.[0]?.message?.content || "{}";
  raw = raw.replace(/```json|```/g, "").trim();

  let more = { days: [] };
  try {
    more = JSON.parse(raw);
  } catch {
    more = { days: [] };
  }

  const extraDays = Array.isArray(more.days) ? more.days : [];
  const merged = [...current];

  // Merge only new day numbers; avoid duplicates
  for (const d of extraDays) {
    const n = Number(d?.day);
    if (!Number.isFinite(n)) continue;
    if (n < 1 || n > requestedDays) continue;
    if (merged.some((x) => Number(x?.day) === n)) continue;
    merged.push(d);
  }

  // Ensure order Day 1..N
  merged.sort((a, b) => Number(a?.day) - Number(b?.day));
  return merged.slice(0, requestedDays);
}

/* ---------------------------------------------------------------
   HYBRID IMAGE RESOLVER (kept)
---------------------------------------------------------------*/
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function resolveImage(a, destinationHint = "") {
  try {
    const baseTitle = a.title || "tourist attraction";
    const queryText = destinationHint ? `${baseTitle}, ${destinationHint}` : baseTitle;

    const query = encodeURIComponent(queryText);
    const placeIdParam = a.placeId ? `&placeId=${a.placeId}` : "";

    const res = await fetch(
      `${getBaseUrl()}/api/images?q=${query}${placeIdParam}&limit=1`,
      { cache: "no-store" }
    );

    const data = await res.json();

    return {
      url: data?.images?.[0]?.url || null,
      place: data?.place || null,
    };
  } catch {
    return { url: null, place: null };
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

    const destinationHint = extractDestinationHint(userPrompt);

    // Resolve user's current city from lat/lon
    const userCity = await reverseGeocodeCity(userLocation?.lat, userLocation?.lon);

    // Trip city: prefer explicit destination, else user's current city
    const tripCity = destinationHint || userCity || "";

    // Only force breakfast-first if user already in the same city
    const requireBreakfast = cityMatches(userCity, tripCity);

    // ✅ Deterministic requested days
    const requestedDays = extractRequestedDays(userPrompt);

    const client = await getOpenAI();

    // First attempt: generate full itinerary
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Return JSON only." },
        {
          role: "user",
          content: buildPrompt(userPrompt, destinationHint, requireBreakfast, userCity, tripCity),
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

    let days = Array.isArray(itinerary.days) ? itinerary.days.slice(0, MAX_DAYS) : [];

    // ✅ If model returned fewer days than requested, generate missing days only
    days = await generateMissingDaysIfNeeded({
      client,
      userPrompt,
      destinationHint,
      requireBreakfast,
      userCity,
      tripCity,
      days,
      requestedDays,
    });

    /* -------------------- POST-PROCESS SANITY (kept) -------------------- */
    const promptHasDates =
      /\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
        userPrompt
      );

    if (!promptHasDates && isMindilLikelyClosedNow()) {
      for (const day of days) {
        if (!Array.isArray(day.activities)) continue;
        for (const a of day.activities) {
          const t = (a?.title || "").toString().toLowerCase();
          if (t.includes("mindil") && t.includes("market")) {
            a.title = "Lunch at Darwin Waterfront Precinct";
            a.description =
              "Enjoy lunch at the Darwin Waterfront precinct with a choice of cafes and restaurants, then take a stroll along the harbour views.";
            a.image = null;
            a.placeId = null;
            a.latitude = null;
            a.longitude = null;
            a.coordinates = null;
            a.website = null;
            a.mapsUrl = null;
          }
        }
      }
    }

    /* -------------------- LIMIT ACTIVITIES -------------------- */
    for (const day of days) {
      day.activities = Array.isArray(day.activities)
        ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY)
        : [];
    }

    /* -------------------- 1) BREAKFAST FIRST (deterministic) -------------------- */
    enforceBreakfastFirst(days, requireBreakfast);

    /* -------------------- 2) HYDRATE (image + place basics) -------------------- */
    await Promise.allSettled(
      days.map(async (day) => {
        await Promise.allSettled(
          day.activities.map(async (a) => {
            if (!a?.title) return;

            const resolved = await resolveImage(a, tripCity || destinationHint);
            if (!a.image && resolved?.url) a.image = resolved.url;

            const p = resolved?.place;
            if (p) {
              if (!a.placeId && p.placeId) a.placeId = p.placeId;
              if (!a.latitude && Number.isFinite(Number(p.lat))) a.latitude = Number(p.lat);
              if (!a.longitude && Number.isFinite(Number(p.lon))) a.longitude = Number(p.lon);

              if (!a.mapsUrl && p.mapsUrl) a.mapsUrl = p.mapsUrl;
              if (!a.mapsUrl && p.url) a.mapsUrl = p.url;

              if (!a.website) {
                if (p.website) a.website = p.website;
                else if (p.mapsUrl) a.website = p.mapsUrl;
                else if (p.url) a.website = p.url;
              }

              if (
                !a.coordinates &&
                Number.isFinite(Number(a.latitude)) &&
                Number.isFinite(Number(a.longitude))
              ) {
                a.coordinates = {
                  lat: Number(a.latitude),
                  lon: Number(a.longitude),
                };
              }
            }
          })
        );
      })
    );

    /* -------------------- 3) OPENING HOURS ENFORCEMENT (kept) -------------------- */
    await normalizeTimesToOpeningHours(days, tripCity);

    /* -------------------- 4) MEALS + NIGHT ENFORCEMENT (kept) -------------------- */
    enforceMealsAndNight(days, tripCity);

    return {
      ok: true,
      itinerary: { days },
      userLocation,
    };
  } catch (err) {
    console.error("ITINERARY HANDLER ERROR:", err);
    return { ok: false, error: "Itinerary generation failed" };
  }
}
