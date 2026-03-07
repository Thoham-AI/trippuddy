// src/lib/weather.js

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
  // 1. Kiểm tra API Key ngay từ đầu
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.error("⚠️ Weather Error: OPENWEATHER_API_KEY is missing in .env");
    return null;
  }

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", "metric");

    // 2. Thêm timeout để tránh treo server (Next.js 13+ fetch hỗ trợ signal)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 giây là quá đủ

    const res = await fetch(url.toString(), { 
      signal: controller.signal,
      cache: "no-store" 
    });
    
    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`🔥 Weather API Responded with ${res.status}: ${errorText}`);
      return null;
    }

    const data = await res.json();
    
    // Kiểm tra dữ liệu data có hợp lệ không trước khi truy cập
    if (!data || !data.main) return null;

    const rainMm =
      data.rain?.["1h"] ??
      data.rain?.["3h"] ??
      undefined;

    const link = `https://openweathermap.org/find?q=${encodeURIComponent(
      data.name || ""
    )}`;

    return {
      description: data.weather?.[0]?.description ?? "unknown",
      tempC: Math.round(data.main?.temp), // Làm tròn cho đẹp UI
      feelsLikeC: Math.round(data.main?.feels_like),
      rainMm,
      link,
    };
  } catch (err: any) {
    // 3. Catch mọi lỗi (Network, Timeout, Parsing) để tránh trả về 502
    if (err.name === 'AbortError') {
      console.error("🕒 Weather API Timeout - Skipping weather info.");
    } else {
      console.error("❌ Weather Utility Error:", err.message);
    }
    return null; // Trả về null thay vì để crash route
  }
}