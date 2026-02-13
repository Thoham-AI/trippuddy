// src/lib/weather.ts

export interface WeatherInfo {
  description: string;
  tempC: number;
  feelsLikeC: number;
  rainMm?: number;
  link?: string;
}

export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<WeatherInfo | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const rainMm =
    data.rain?.["1h"] ??
    data.rain?.["3h"] ??
    undefined;

  const link = `https://openweathermap.org/find?q=${encodeURIComponent(
    data.name || ""
  )}`;

  return {
    description: data.weather?.[0]?.description ?? "unknown",
    tempC: data.main?.temp,
    feelsLikeC: data.main?.feels_like,
    rainMm,
    link,
  };
}
