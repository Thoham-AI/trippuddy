// src/app/api/destinations/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib"; // cleaned
// ✅ Using native fetch (Next.js runtime)

const FONT_PATH = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");

// --- Cache ---
const CACHE_PATH = "/tmp/travel_ai_cache.json";
let cache = { coords: {}, hours: {}, images: {} };
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

// --- Nominatim ---
async function fetchCoordinates(placeName, city = "") {
  const key = `${placeName}-${city}`;
  if (cache.coords[key]) return cache.coords[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        placeName + " " + city
      )}`,
      { headers: { "User-Agent": "travel-ai-app" } }
    );
    const text = await res.text();
    if (!text.startsWith("[") && !text.startsWith("{")) return null;
    const data = JSON.parse(text);
    if (data.length > 0) {
      const coords = {
        lat: data[0].lat,
        lon: data[0].lon,
        display_name: data[0].display_name,
      };
      cache.coords[key] = coords;
      saveCache();
      return coords;
    }
  } catch (err) {
    console.error("Nominatim error:", err);
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
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
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

// --- Google Maps ---
function generateGoogleMapsLink(placeName, country = "") {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    placeName + " " + country
  )}`;
}

// --- PDF generator ---
async function generatePDF(itineraryData) {
  const pdfDoc = await PDFDocument.create();
  const fontBytes = fs.readFileSync(FONT_PATH);
  const font = await pdfDoc.embedFont(fontBytes);

  const pageMargin = 50;
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  let y = page.getHeight() - pageMargin;

  const newPage = () => {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = page.getHeight() - pageMargin;
  };

  const drawWrappedText = (text, size = 12, indent = 0) => {
    const maxWidth = page.getWidth() - pageMargin * 2 - indent;
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line + word + " ";
      const width = font.widthOfTextAtSize(testLine, size);
      if (width > maxWidth) {
        page.drawText(line, { x: pageMargin + indent, y, size, font });
        line = word + " ";
        y -= size + 4;
        if (y < 100) newPage();
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: pageMargin + indent, y, size, font });
      y -= size + 4;
    }
  };

  const drawImage = async (imgUrl, maxWidth = 300) => {
    try {
      const imgBytes = await fetch(imgUrl).then((r) => r.arrayBuffer());
      let embeddedImg;
      try {
        embeddedImg = await pdfDoc.embedJpg(imgBytes);
      } catch {
        embeddedImg = await pdfDoc.embedPng(imgBytes);
      }

      const aspect = embeddedImg.height / embeddedImg.width;
      const imgWidth = Math.min(maxWidth, page.getWidth() - 2 * pageMargin);
      const imgHeight = imgWidth * aspect;
      if (y - imgHeight < 100) newPage();
      page.drawImage(embeddedImg, {
        x: pageMargin,
        y: y - imgHeight,
        width: imgWidth,
        height: imgHeight,
      });
      y -= imgHeight + 10;
    } catch (e) {
      console.warn("Image embed failed:", imgUrl);
    }
  };

  // --- Title
  page.drawText("🗺️ Travel Itinerary", {
    x: pageMargin,
    y,
    size: 20,
    font,
    color: rgb(0.1, 0.1, 0.4),
  });
  y -= 40;

  // --- Destinations
  drawWrappedText("Destinations:", 16);
  for (const dest of itineraryData.destinations) {
    drawWrappedText(`${dest.name} (${dest.country}) - ${dest.description}`, 12);
    if (dest.image) await drawImage(dest.image);
  }

  // --- Itinerary
  drawWrappedText("Itinerary:", 16);
  for (const day of itineraryData.itinerary) {
    drawWrappedText(`Day ${day.day}: ${day.date}`, 14);
    for (const act of day.activities) {
      drawWrappedText(`${act.time} - ${act.title}`, 12, 10);
      drawWrappedText(act.details || "", 10, 20);
      if (act.image) await drawImage(act.image, 250);
    }
  }

  return await pdfDoc.save();
}

// --- Main POST ---
export async function POST(req) {
  try {
    const { prompt, exportPdf } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const ai = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional travel planner AI.
Always respond ONLY with valid JSON:
{
  "destinations":[{"name":"string","country":"string","description":"string","image":"string"}],
  "itinerary":[{"day":number,"date":"string","activities":[{"time":"string","title":"string","location":"string","details":"string","cost_estimate":"string","link":"string","image":"string"}]}]
}
- 3–6 activities per day
- Include food or cultural experiences
- Use internationally recognized names in English
- No extra explanations outside JSON
          `,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const rawText = ai.choices[0].message.content.trim();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON parse error:", rawText);
      return NextResponse.json({ error: "AI response invalid" }, { status: 500 });
    }

    for (const day of data.itinerary) {
      for (const act of day.activities) {
        const coords = await fetchCoordinates(act.location);
        if (coords) {
          act.coordinates = coords;
          const hours = await fetchOpeningHours(coords.lat, coords.lon);
          if (hours) act.details += ` | Opening hours: ${hours}`;
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

    // 📝 If PDF requested, return file
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
    console.error("API Error:", err);
    return NextResponse.json({ error: "Failed to generate itinerary" }, { status: 500 });
  }
}
