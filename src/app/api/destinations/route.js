import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const TMP_DIR = "/tmp";
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const CACHE_PATH = path.join(TMP_DIR, "travel_ai_cache.json");
let cache = {};

try {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  }
} catch (err) {
  console.error("Cache load error:", err);
}

cache.coords = cache.coords || {};
cache.hours = cache.hours || {};
cache.images = cache.images || {};
cache.weather = cache.weather || {};
cache.poi = cache.poi || {};

function saveCache() {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error("Cache save error:", err);
  }
}

// --- Global throttle ---
let lastRequestTime = 0;
async function throttle(ms = 300) {
  const now = Date.now();
  const diff = now - lastRequestTime;
  if (diff < ms) await new Promise((r) => setTimeout(r, ms - diff));
  lastRequestTime = Date.now();
}

// --- Unsplash (Resilient version) ---
async function fetchUnsplashImage(query, attempt = 1) {
  if (!query) return "/fallback.jpg";
  if (cache.images[query]) return cache.images[query];
  await throttle(500);

  try {
    console.log(`🔍 Fetching Unsplash for "${query}" (try ${attempt})`);
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&client_id=${process.env.UNSPLASH_ACCESS_KEY}&orientation=landscape&per_page=1`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`❌ Unsplash HTTP ${res.status}: ${await res.text()}`);
      return "/fallback.jpg";
    }

    const data = await res.json();
    if (data?.results?.length) {
      const imgUrl = data.results[0].urls.small;
      cache.images[query] = imgUrl;
      saveCache();
      return imgUrl;
    }

    // 🪄 Fallback: retry with shorter tail of query (last 1–2 words)
    if (attempt < 2 && query.includes(" ")) {
      const parts = query.trim().split(/\s+/);
      const shorter = parts.slice(-2).join(" ");
      return await fetchUnsplashImage(shorter, attempt + 1);
    }
  } catch (err) {
    console.error(`Unsplash error for "${query}":`, err);
  }

  cache.images[query] = "/fallback.jpg";
  saveCache();
  return "/fallback.jpg";
}

// --- Helper fetch ---
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
}

// --- Country helpers (ISO2 bias for Nominatim) ---
const COUNTRY_TO_ISO2 = {
  singapore: "sg",
  "united states": "us",
  usa: "us",
  "united kingdom": "gb",
  uk: "gb",
  australia: "au",
  japan: "jp",
  vietnam: "vn",
  thailand: "th",
  malaysia: "my",
  indonesia: "id",
  france: "fr",
  italy: "it",
  spain: "es",
  germany: "de",
  canada: "ca",
  china: "cn",
  "south korea": "kr",
  "hong kong": "hk",
};

function iso2FromCountry(country) {
  if (!country) return null;
  const key = String(country).toLowerCase().trim();
  return COUNTRY_TO_ISO2[key] || null;
}

// --- Nominatim (context-aware: name + city + country + ISO2) ---
async function fetchCoordinates(placeName, city = "", country = "") {
  const key = `${placeName}-${city}-${country}`;
  if (cache.coords[key]) return cache.coords[key];

  const params = new URLSearchParams({
    format: "json",
    q: `${placeName} ${city} ${country}`.trim(),
    addressdetails: "1",
    limit: "3",
  });

  const iso2 = iso2FromCountry(country);
  if (iso2) params.set("countrycodes", iso2);

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  try {
    const res = await fetchWithTimeout(url, {
      timeout: 9000,
      headers: { "User-Agent": "travel-ai-app" },
    });
    const text = await res.text();
    if (!text.startsWith("[") && !text.startsWith("{")) return null;
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      // Prefer match inside the requested country when possible
      let chosen = data[0];
      if (country) {
        const preferred = data.find(
          (d) =>
            d?.address?.country &&
            d.address.country.toLowerCase().includes(country.toLowerCase())
        );
        if (preferred) chosen = preferred;
      }
const coords = {
  lat: parseFloat(chosen.lat),
  lon: parseFloat(chosen.lon),
  display_name: chosen.display_name,
  osm_id: chosen.osm_id || chosen.osmid || null,
};

      cache.coords[key] = coords;
      saveCache();
      return coords;
    }
  } catch (err) {
    console.warn(
      `Nominatim failed for "${placeName} ${city} ${country}":`,
      err.message
    );
  }
  return null;
}

// 🔁 Reverse geocode (to get user's city/country from lat/lon)
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const res = await fetchWithTimeout(url, {
      timeout: 9000,
      headers: { "User-Agent": "travel-ai-app" },
    });
    const text = await res.text();
    if (!text.startsWith("{")) return null;
    const json = JSON.parse(text);
    const a = json.address || {};
    // pick best available city-ish field
    const city =
      a.city ||
      a.town ||
      a.village ||
      a.municipality ||
      a.state_district ||
      a.state ||
      "";
    const country = a.country || "";
    return { city, country };
  } catch (err) {
    console.warn("reverseGeocode failed:", err.message);
    return null;
  }
}

// --- Overpass Opening Hours ---
async function fetchOpeningHours(lat, lon) {
  const key = `${lat},${lon}`;
  if (cache.hours[key]) return cache.hours[key];

  const query = `
    [out:json];
    node(around:200,${lat},${lon})[opening_hours];
    out 1;
  `;
  try {
    const res = await fetchWithTimeout("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      timeout: 10000,
    });
    const text = await res.text();
    if (!text.startsWith("{")) return null;
    const json = JSON.parse(text);
    if (json.elements?.length > 0) {
      const hours = json.elements[0].tags.opening_hours || null;
      cache.hours[key] = hours;
      saveCache();
      return hours;
    }
  } catch (err) {
    console.error("Overpass error:", err);
  }
  return null;
}

// --- Overpass Nearby POI ---
async function fetchNearbyPOI(lat, lon) {
  const key = `poi-${lat},${lon}`;
  if (cache.poi[key]) return cache.poi[key];

  const query = `
    [out:json][timeout:15];
    (
      node(around:1200,${lat},${lon})[tourism~"attraction|museum|gallery"];
      node(around:1200,${lat},${lon})[amenity~"restaurant|cafe|bar"];
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const res = await fetchWithTimeout("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      timeout: 15000,
    });
    const text = await res.text();
    if (!text.startsWith("{")) return [];
    const json = JSON.parse(text);
    const poi = json.elements
      .filter((el) => el.tags?.name)
      .slice(0, 10)
      .map((el) => ({
        name: el.tags.name,
        type: el.tags.amenity || el.tags.tourism || "place",
        lat: el.lat,
        lon: el.lon,
      }));
    cache.poi[key] = poi;
    saveCache();
    return poi;
  } catch (err) {
    console.error("Nearby POI error:", err);
  }
  return [];
}

// --- OpenWeather (Forecast) ---
async function fetchWeather(lat, lon, dateString = null) {
  const key = `${lat},${lon},${dateString || "today"}`;
  if (cache.weather[key]) return cache.weather[key];

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetchWithTimeout(url, { timeout: 8000 });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.list?.length) return null;

    let target;
    if (dateString) {
      const targetDate = new Date(dateString);
      target = data.list.reduce((closest, item) => {
        const itemDate = new Date(item.dt * 1000);
        const diff = Math.abs(itemDate - targetDate);
        return !closest || diff < closest.diff ? { item, diff } : closest;
      }, null)?.item;
    } else target = data.list[0];

    if (target) {
      const info = {
        temp: Math.round(target.main.temp),
        description: target.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${target.weather[0].icon}@2x.png`,
        link: `https://openweathermap.org/weathermap?zoom=8&lat=${lat}&lon=${lon}`,
      };
      cache.weather[key] = info;
      saveCache();
      console.log("✅ Weather fetched successfully for", key);
      return info;
    }
  } catch (err) {
    console.error("OpenWeather error:", err);
  }
  return null;
}

// --- Google Maps ---
function generateGoogleMapsLink(placeName, city = "", country = "") {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [placeName, city, country].filter(Boolean).join(" ")
  )}`;
}

// --- Helpers: normalize activity & image query ---
function normalizeActivity(act, fallbackCity = "", fallbackCountry = "") {
  // Upgrade string -> structured object without breaking older outputs
  if (!act.location || typeof act.location === "string") {
    const name =
      typeof act.location === "string"
        ? act.location
        : act.title || "Point of interest";
    act.location = { name, city: fallbackCity, country: fallbackCountry };
  } else {
    act.location.name = act.location.name || act.title || "Point of interest";
    act.location.city = act.location.city || fallbackCity;
    act.location.country = act.location.country || fallbackCountry;
  }
  return act;
}

function imageQueryFromLocation(loc) {
  return [loc.name, loc.city, loc.country].filter(Boolean).join(" ");
}

function weatherLooksImpossibleForCountry(w, country) {
  if (!w || !country) return false;
  const c = String(country).toLowerCase();
  if (c === "singapore" && w.temp < 18) return true;
  if (c === "malaysia" && w.temp < 15) return true;
  if (c === "indonesia" && w.temp < 15) return true;
  return false;
}

// 🔢 small distance helper (fallback check if reverse geocode fails)
function distKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin;
  const c = Math.cos;
  const x =
    s(dLat / 2) ** 2 +
    c((a.lat * Math.PI) / 180) * c((b.lat * Math.PI) / 180) * s(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// --- POST ---
export async function POST(req) {
  try {
    const { prompt, style, exportPdf, userLocation } = await req.json();
    console.log("📡 Received user location:", userLocation);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const today = new Date();
    const currentDate = today.toISOString().split("T")[0];

    // Stronger schema: enforce structured locations with city+country
    const systemPrompt = `
You are a professional travel planner AI.
User travel style: "${style || "general"}".
Return ONLY valid JSON in this structure:
{
  "destinations":[{"name":"string","city":"string","country":"string","description":"string"}],
  "itinerary":[
    {
      "day":number,
      "date":"YYYY-MM-DD",
      "city":"string",
      "country":"string",
      "activities":[
        {
          "time":"string",
          "title":"string",
          "location":{"name":"string","city":"string","country":"string"},
          "details":"string",
          "cost_estimate":"string",
          "link":"string"
        }
      ]
    }
  ]
}
Rules:
- Every activity MUST include location.city and location.country.
- City/country must align with the intended destination(s) in the prompt.
- Do not add any text outside the JSON.
Start date: ${currentDate}
`;

    const ai = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    });

    // Robust JSON extraction (handles accidental prose)
    const rawText = (ai.choices?.[0]?.message?.content || "").trim();
    const jsonText = (() => {
      const s = rawText.indexOf("{");
      const e = rawText.lastIndexOf("}");
      return s >= 0 && e > s ? rawText.slice(s, e + 1) : rawText;
    })();

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON parse error:", rawText);
      return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
    }

    // Inherit day.city/country from first destination if missing
    const firstDest =
      Array.isArray(data.destinations) && data.destinations[0]
        ? data.destinations[0]
        : {};
    for (const day of data.itinerary || []) {
      day.city = day.city || firstDest.city || "";
      day.country = day.country || firstDest.country || "";

      // Normalize each activity -> structured location
      for (const act of day.activities || []) {
        normalizeActivity(act, day.city, day.country);
      }
    }

    // 🔐 A — Only show POIs if destination = current city
    // Determine planned city (Day 1) and user's current city (reverse geocode).
    const plannedCity = data.itinerary?.[0]?.city || firstDest.city || "";
    const plannedCountry =
      data.itinerary?.[0]?.country || firstDest.country || "";

    let injectPOIs = false;
    if (userLocation && plannedCity) {
      // try reverse geocoding user's current city
      const rev = await reverseGeocode(userLocation.lat, userLocation.lon);
      const norm = (s) => (s || "").toLowerCase().trim();

      if (rev?.city && norm(rev.city) === norm(plannedCity)) {
        injectPOIs = true;
      } else {
        // fallback: distance check (within ~30km of the destination city center)
        const plannedCenter = await fetchCoordinates(
          plannedCity,
          plannedCity,
          plannedCountry
        );
        if (plannedCenter) {
          const dist = distKm(
            { lat: userLocation.lat, lon: userLocation.lon },
            plannedCenter
          );
          if (isFinite(dist) && dist <= 30) injectPOIs = true;
        }
      }
    }

    // 🧭 Add local POIs ONLY when the user's city == destination city (or nearby)
    if (injectPOIs && data.itinerary?.[0]) {
      const poiList = await fetchNearbyPOI(userLocation.lat, userLocation.lon);
      const d0 = data.itinerary[0];
      const poiActivities = await Promise.all(
        poiList.slice(0, 4).map(async (poi) => {
          const loc = {
            name: poi.name,
            city: d0.city || "",
            country: d0.country || "",
          };
          return {
            time: "Flexible",
            title: poi.name,
            location: loc,
            details: `Nearby ${poi.type}`,
            link: generateGoogleMapsLink(loc.name, loc.city, loc.country),
            image: await fetchUnsplashImage(imageQueryFromLocation(loc)),
          };
        })
      );
      d0.activities = [...poiActivities, ...(d0.activities || [])];
    }

    // Enrich each activity (coords + weather + image + link)
    for (const day of data.itinerary || []) {
      for (const act of day.activities || []) {
        const loc = act.location;
        const coords = await fetchCoordinates(loc.name, loc.city, loc.country);
        if (coords) {
          act.coordinates = coords;
          let weather = await fetchWeather(coords.lat, coords.lon, day.date);
          // Sanity check: retry if weather temp is impossible for that country
          if (weatherLooksImpossibleForCountry(weather, loc.country)) {
            const retryCoords = await fetchCoordinates(
              loc.city || loc.name,
              loc.city,
              loc.country
            );
            if (retryCoords) {
              act.coordinates = retryCoords;
              weather = await fetchWeather(
                retryCoords.lat,
                retryCoords.lon,
                day.date
              );
            }
          }
          if (weather) act.weather = weather;
        }

        const imgQuery = imageQueryFromLocation(loc);
        act.image = await fetchUnsplashImage(imgQuery);
        // 🔗 Smart website lookup (fallback to Google Maps)
let website = null;

if (coords?.display_name) {
  try {
    const detailUrl = `https://nominatim.openstreetmap.org/details.php?osmtype=N&osmid=${coords.osm_id || ""}&class&format=json`;
    const res = await fetchWithTimeout(detailUrl, {
      timeout: 7000,
      headers: { "User-Agent": "travel-ai-app" },
    });
    const detail = await res.json();

    // Prefer official website
    if (detail?.extratags?.website) {
      website = detail.extratags.website.startsWith("http")
        ? detail.extratags.website
        : `https://${detail.extratags.website}`;
    }

    // Wikipedia fallback
    else if (detail?.extratags?.wikidata) {
      website = `https://www.wikidata.org/wiki/${detail.extratags.wikidata}`;
    } else if (detail?.extratags?.wikipedia) {
      const [lang, page] = detail.extratags.wikipedia.split(":");
      website = `https://${lang}.wikipedia.org/wiki/${page}`;
    }
  } catch {
    /* ignore errors */
  }
}

// 🗺️ Default fallback = Google Maps
act.link = website || act.link || generateGoogleMapsLink(loc.name, loc.city, loc.country);


        // (Optional) Opening hours — keep but non-blocking
        // const hours = await fetchOpeningHours(act.coordinates?.lat, act.coordinates?.lon);
        // if (hours) act.opening_hours = hours;
      }
    }

    // Destination images + map URLs with full context
    for (const dest of data.destinations || []) {
      const q = [dest.name, dest.city, dest.country].filter(Boolean).join(" ");
      dest.image = await fetchUnsplashImage(q);
      dest.mapUrl = generateGoogleMapsLink(dest.name, dest.city, dest.country);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("💥 API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
