import { NextResponse } from "next/server";

// Open-Meteo weather codes -> simple labels
function codeToCondition(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75].includes(code)) return "Snow";
  if (code === 77) return "Snow grains";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95].includes(code)) return "Thunderstorm";
  if ([96, 99].includes(code)) return "Thunderstorm";
  return "Unknown";
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid lat/lon" },
        { status: 400 }
      );
    }

    const apiUrl =
      "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: "temperature_2m,weather_code",
        timezone: "auto",
      }).toString();

    const r = await fetch(apiUrl, { cache: "no-store" });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `Upstream error: ${r.status}` },
        { status: 502 }
      );
    }

    const data = await r.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;

    if (!Number.isFinite(temp) || !Number.isFinite(code)) {
      return NextResponse.json(
        { ok: false, error: "Weather data unavailable" },
        { status: 502 }
      );
    }

    const condition = codeToCondition(Number(code));

    return NextResponse.json({
      ok: true,
      temperatureC: Math.round(Number(temp)),
      condition,
      weatherCode: Number(code),
      // for “click to website”
      websiteUrl: `https://www.google.com/search?q=${encodeURIComponent(
        `weather ${lat},${lon}`
      )}`,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
