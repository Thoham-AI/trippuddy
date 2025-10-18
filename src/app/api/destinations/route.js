import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const TMP_DIR = "/tmp";
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const CACHE_PATH = path.join(TMP_DIR, "travel_ai_cache.json");
let cache = { coords: {}, hours: {}, images: {}, weather: {} };

try {
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  }
} catch (err) {
  console.error("Cache load error:", err);
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error("Cache save error:", err);
  }
}

// --- Unsplash ---
async function fetchUnsplashImage(query) {
  if (cache.images[query]) return cache.images[query];
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&client_id=${process.env.UNSPLASH_ACCESS_KEY}&orientation=landscape&per_page=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results?.length > 0) {
      const imgUrl = data.results[0].urls.regular;
      cache.images[query] = imgUrl;
      saveCache();
      return imgUrl;
    }
  } catch (err) {
    console.error("Unsplash error:", err);
  }
  return "/fallback.jpg";
}

// --- Helper for timeout fetch ---
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
}

// --- Nominatim ---
async function fetchCoordinates(placeName, city = "") {
  const key = `${placeName}-${city}`;
  if (cache.coords[key]) return cache.coords[key];

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    placeName + " " + city
  )}`;

  try {
    const res = await fetchWithTimeout(url, {
      timeout: 8000,
      headers: { "User-Agent": "travel-ai-app" },
    });
    const text = await res.text();
    if (!text.startsWith("[") && !text.startsWith("{")) return null;
    const data = JSON.parse(text);
    if (data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
      cache.coords[key] = coords;
      saveCache();
      return coords;
    }
  } catch (err) {
    console.warn(`Nominatim failed:`, err.message);
  }
  return null;
}

// --- Overpass ---
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

// --- OpenWeather (Forecast) ---
async function fetchWeather(lat, lon, dateString = null) {
  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    console.warn("⚠️ Skipping weather due to invalid coordinates:", lat, lon);
    return null;
  }

  const key = `${lat},${lon},${dateString || "today"}`;
  if (cache.weather[key]) {
    console.log("✅ Returning cached weather for", key);
    return cache.weather[key];
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  console.log("🔑 OPENWEATHER_API_KEY loaded:", !!apiKey);
  if (!apiKey) {
    console.error("❌ No OPENWEATHER_API_KEY found.");
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetchWithTimeout(url, { timeout: 8000 });

    if (!res.ok) {
      console.error("❌ OpenWeather Forecast Error:", res.status, await res.text());
      return null;
    }

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
    } else {
      target = data.list[0];
    }

    if (target) {
      const info = {
        temp: Math.round(target.main.temp),
        description: target.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${target.weather[0].icon}@2x.png`,
        link: `https://openweathermap.org/weathermap?zoom=8&lat=${lat}&lon=${lon}`,
        timestamp: target.dt,
      };
      cache.weather[key] = info;
      saveCache();
      console.log("✅ Weather fetched successfully for", key);
      return info;
    }
  } catch (err) {
    console.error("❌ OpenWeather error:", err);
  }

  console.warn("⚠️ No weather data returned for", key);
  return null;
}

// --- Google Maps ---
function generateGoogleMapsLink(placeName, country = "") {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    placeName + " " + country
  )}`;
}

// --- Puppeteer-based PDF Generator ---
async function generatePDF(itineraryData) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans&display=swap');
          body { font-family: 'Noto Sans', sans-serif; padding: 40px; color: #222; background: #fff; }
          h1 { color: #003366; font-size: 28px; margin-bottom: 20px; }
          h2 { color: #004080; font-size: 22px; margin-top: 30px; }
          h3 { color: #0059b3; font-size: 18px; margin-top: 20px; }
          p { font-size: 14px; line-height: 1.6; }
          img { max-width: 100%; border-radius: 10px; margin: 10px 0; }
          .dest-card { margin-bottom: 30px; }
          .activity { margin-bottom: 15px; }
          .footer { text-align:center; margin-top:40px; font-size:12px; color:#555; }
        </style>
      </head>
      <body>
        <h1>🗺️ Travel Itinerary</h1>
        <h2>Destinations:</h2>
        ${itineraryData.destinations.map((d, i) => `
          <div class="dest-card">
            <h3>${i + 1}. ${d.name} (${d.country})</h3>
            <p>${d.description}</p>
            ${d.image ? `<img src="${d.image}" />` : ""}
          </div>`).join("")}
        <h2>Itinerary:</h2>
        ${itineraryData.itinerary.map((day) => `
          <h3>Day ${day.day}: ${day.date}</h3>
          ${day.activities.map((a) => `
            <div class="activity">
              <strong>${a.time} — ${a.title}</strong><br />
              <p>${a.details || ""}</p>
              ${a.image ? `<img src="${a.image}" />` : ""}
            </div>`).join("")}`).join("")}
        <div class="footer">Generated by Travel AI Assistant</div>
      </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBytes = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  return pdfBytes;
}

// --- POST ---
export async function POST(req) {
  try {
    const { prompt, style, exportPdf } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const today = new Date();
    const currentDate = today.toISOString().split("T")[0];

    const systemPrompt = `
You are a professional travel planner AI.
The user wants the itinerary to reflect their personal travel style: "${style || "general"}".
Always respond ONLY with valid JSON:
{
  "destinations":[{"name":"string","country":"string","description":"string","image":"string"}],
  "itinerary":[{"day":number,"date":"string","activities":[{"time":"string","title":"string","location":"string","details":"string","cost_estimate":"string","link":"string","image":"string"}]}]
}
- 3–6 activities per day
- Include food or cultural experiences if they match the style
- Use internationally recognized names in English
- The itinerary must start from today’s date: ${currentDate}
- No extra explanations outside JSON
    `;

    const ai = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
    });

    const rawText = ai.choices[0].message.content.trim();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON parse error:", rawText);
      return NextResponse.json({ error: "AI response invalid" }, { status: 500 });
    }

    // Enrich itinerary with coordinates, opening hours, forecast weather, images
    for (const day of data.itinerary) {
      for (const act of day.activities) {
        const coords = await fetchCoordinates(act.location);
        if (coords) {
          act.coordinates = coords;
          const hours = await fetchOpeningHours(coords.lat, coords.lon);
          if (hours) act.details += ` | Opening hours: ${hours}`;
          const weather = await fetchWeather(coords.lat, coords.lon, day.date);
          if (weather) act.weather = weather;
        }
        if (!act.link || act.link.includes("goo.gl") || act.link.includes("firebase")) {
          act.link = generateGoogleMapsLink(act.location);
        }
        act.image = await fetchUnsplashImage(act.location);
      }
    }

    for (const dest of data.destinations) {
      dest.image = await fetchUnsplashImage(dest.name + " " + dest.country);
      dest.mapUrl = generateGoogleMapsLink(dest.name, dest.country);
    }

    if (exportPdf) {
      const pdfBytes = await generatePDF(data);
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="itinerary.pdf"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("💥 API Error:", err);
    return NextResponse.json(
      { error: "Failed to generate itinerary", details: err.message },
      { status: 500 }
    );
  }
}
