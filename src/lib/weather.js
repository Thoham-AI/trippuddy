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
    // Thêm ngôn ngữ tiếng Việt để description trả về "trời quang", "mưa nhẹ"...
    url.searchParams.set("lang", "vi");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url.toString(), { 
      signal: controller.signal,
      // Với Itinerary, có thể dùng ISR để cache 30 phút thay vì no-store để tăng tốc độ load
      next: { revalidate: 1800 } 
    });
    
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`🔥 Weather API Error ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data || !data.main) return null;

    const rainMm = data.rain?.["1h"] ?? data.rain?.["3h"] ?? undefined;

    // Tối ưu link cho vùng hẻo lánh: dùng tọa độ trực tiếp để mở bản đồ thời tiết
    // Thay vì dùng tên địa danh (thường bị sai ở vùng cao), dùng lat/lon để dẫn thẳng tới vị trí đó
    const link = `https://openweathermap.org/city/${data.id || ""}`; 
    // Hoặc link Google Maps thời tiết:
    const mapLink = `https://www.google.com/maps/@${lat},${lon},12z`;

    return {
      // Viết hoa chữ cái đầu cho description để hiển thị đẹp hơn
      description: data.weather?.[0]?.description 
        ? data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1)
        : "Không xác định",
      tempC: Math.round(data.main.temp),
      feelsLikeC: Math.round(data.main.feels_like),
      rainMm,
      link: link || mapLink,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error("🕒 Weather API Timeout");
    } else {
      console.error("❌ Weather Utility Error:", err.message);
    }
    return null;
  }
}