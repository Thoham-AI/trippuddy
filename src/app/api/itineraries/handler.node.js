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
  return "";
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
    "culture","food","culinary","itinerary","trip","travel","guide","plan","plans",
    "beach","adventure","relax","relaxing","shopping","nature","history","historic",
    "with","for","and","in"
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
  return /\b(night|nightlife|bar|club|pub|late|after dark|evening market|night market)\b/.test(p);
}

function minutesFromHHMM(hhmm) {
  return parseHHMM(hhmm);
}

function setArrival(a, mins) {
  if (!a) return;
  a.arrival_time = fmtHHMM(mins);
}

function ensureMealSlotsPerDay(days, tripCity, userPrompt) {
  const avoidNight = promptIndicatesKidsOrElderly(userPrompt) && !promptRequiresNight(userPrompt);

  for (const day of days || []) {
    if (!Array.isArray(day.activities)) day.activities = [];
    const acts = day.activities;

    const hasLunch = acts.some((x) => /\blunch\b/i.test(String(x?.title || "")));
    const hasDinner = acts.some((x) => /\bdinner\b/i.test(String(x?.title || "")));
    const hasNight = acts.some((x) => /\b(night|evening)\b/i.test(String(x?.title || "")));

    if (!hasLunch) {
      acts.push({
        title: `Lunch in ${tripCity || "the city"}`,
        arrival_time: "12:30",
        duration_minutes: 75,
        description: "Enjoy a popular local lunch spot with regional specialties.",
      });
    }

    if (!hasDinner) {
      acts.push({
        title: `Dinner in ${tripCity || "the city"}`,
        arrival_time: "18:30",
        duration_minutes: 90,
        description: "Have dinner at a well-reviewed local restaurant to end the day well.",
      });
    }

    if (!avoidNight && !hasNight) {
      acts.push({
        title: `Evening stroll / night activity in ${tripCity || "the city"}`,
        arrival_time: "20:30",
        duration_minutes: 75,
        description:
          "Relax with an easy evening activity (night market, riverside walk, or a casual show).",
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
      // Nếu là hoạt động ăn uống, ép thời gian tối đa 90 phút
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

/* ---------------------------------------------------------------
   DESTINATION HINT
---------------------------------------------------------------*/
function extractDestinationHint(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") return "";
  const text = userPrompt.trim();

  const explicit = text.match(/\b(?:in|to|at|visit|around)\s+([\p{L}][\p{L}\s'’-]{1,40})(?:[,.]|$)/iu);
  if (explicit?.[1]) return cleanCityPhrase(explicit[1]);

  const startMatch = text.match(
    /^([\p{L}][\p{L}\s'’-]{1,40})(?:\s+\d+\s+day|\s+\d+\s+days|\s+day|\s+days)\b/iu
  );
  if (startMatch?.[1]) return cleanCityPhrase(startMatch[1]);

  const afterDays = text.match(
    /^\s*\d+\s+days?(?:\s+in)?\s+([\p{L}][\p{L}\s'’-]{1,40})(?:[,.]|$|\s+)/iu
  );
  if (afterDays?.[1]) return cleanCityPhrase(afterDays[1]);

  const p = text.toLowerCase();
  if (p.includes("singapore")) return "Singapore";
  if (p.includes("hanoi")) return "Hanoi";
  if (p.includes("ho chi minh") || p.includes("saigon")) return "Ho Chi Minh City";
  if (p.includes("da nang") || p.includes("danang")) return "Da Nang";
  if (p.includes("hoi an") || p.includes("hoian")) return "Hoi An";
  if (p.includes("tokyo")) return "Tokyo";
  if (p.includes("osaka")) return "Osaka";
  if (p.includes("bangkok")) return "Bangkok";
  if (p.includes("kuala lumpur")) return "Kuala Lumpur";

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

/* --- FIXED: AI PROMPT FOR GEOGRAPHY & TIME --- */
function buildPrompt(prompt, destinationHint = "", requireBreakfast = false, userCity = "", tripCity = "") {
  return `
You are TripPuddy, an expert travel planner for Australia and Vietnam.

Rules:
- Detect number of days from user input
- Output EXACTLY that many days
- 4–6 activities per day
- Morning start (08:00–09:30)
- Real places only
- GEOGRAPHY: ALL activities MUST be inside ${tripCity || destinationHint}. 
- IMPORTANT: DO NOT suggest places in the USA or other countries. If the user asks for Flinders Ranges, ensure it is the one in South Australia.
- TIME: Bữa trưa (Lunch) và Bữa tối (Dinner) chỉ được phép kéo dài từ 60 đến tối đa 90 phút.
- STARTING POINT: ${userCity ? `Người dùng hiện đang ở ${userCity}. Hãy coi đây là điểm xuất phát hoặc tính toán lộ trình từ đây.` : "Bắt đầu tại trung tâm thành phố."}

- Always include at least one food recommendation per day (breakfast/brunch/lunch/dinner), using real places.
${requireBreakfast ? `- Because the user is in the same city as the trip destination, the FIRST activity of EACH day MUST be a breakfast/brunch/coffee place suitable for 08:00–09:30.\n` : ``}
- Respect typical opening hours:
  - Breakfast: 08:00–10:00
  - Museums/attractions: usually after 09:00–10:00
  - Night markets: late afternoon/evening only
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
    // Ghi nhận vị trí người dùng từ input
    const userLocation = input.userLocation || DEFAULT_LOCATION;

    const destinationHint = extractDestinationHint(userPrompt);

    const userCity = await reverseGeocodeCity(userLocation?.lat, userLocation?.lon);
    const tripCity = "";

    const requireBreakfast = cityMatches(userCity, tripCity);

    const client = await getOpenAI();

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

    const days = Array.isArray(itinerary.days)
      ? itinerary.days.slice(0, MAX_DAYS)
      : []

    ensureMealSlotsPerDay(days, tripCity, userPrompt);

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

    for (const day of days) {
      day.activities = Array.isArray(day.activities)
        ? day.activities.slice(0, MAX_ACTIVITIES_PER_DAY)
        : [];
    }

    enforceBreakfastFirst(days, requireBreakfast);

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

    await normalizeTimesToOpeningHours(days, tripCity);

    // Ép thời gian ăn trưa và sắp xếp lại
    enforceLunchBefore(days, 13 * 60 + 30);
    sortActivitiesByTime(days);

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