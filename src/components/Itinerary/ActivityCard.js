"use client";

import { useEffect, useRef, useState } from "react";

const isRealPhoto = (url) => {
  if (!url) return false;
  return !url.includes("maps.googleapis.com/maps/api/staticmap");
};

export default function ActivityCard({
  act,
  loc,
  mode,
  coordinates,
  singleSeg,
  LeafletMap,
  userLocation,
  flag,
  iconFor,
  setPopupImage,
  onSuggestAlternative,
  onFoodSuggestions,
}) {
  const c = coordinates;

  // Weather state (per activity coordinates) — restored working version
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const weatherReq = useRef(0);

  useEffect(() => {
    const lat = c?.lat;
    const lon = c?.lon;

    if (typeof lat !== "number" || typeof lon !== "number") {
      setWeather(null);
      return;
    }

    const seq = ++weatherReq.current;
    const controller = new AbortController();

    async function loadWeather() {
      try {
        setWeatherLoading(true);
        const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await res.json();

        if (seq !== weatherReq.current) return;

        if (data?.ok) setWeather(data);
        else setWeather(null);
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (seq !== weatherReq.current) return;
        setWeather(null);
      } finally {
        if (seq !== weatherReq.current) return;
        setWeatherLoading(false);
      }
    }

    loadWeather();
    return () => controller.abort();
  }, [c?.lat, c?.lon]);

  const openWeatherMap = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const lat = Number(c?.lat);
    const lon = Number(c?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    // Open OpenWeather directly (no internal /weather-map route required)
    const url = `https://openweathermap.org/weathermap?lat=${lat}&lon=${lon}&zoom=10`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="card"
      style={{
        background: "#fff",
        padding: 14,
        borderRadius: 12,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        border: "1px solid #eef2f7",
      }}
    >
      {/* LEFT */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          <b>{act.time || "Flexible"}</b> — {act.title}
        </div>

        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          {/* Destination name line (no extra button below it) */}
          <div>
            📍 {flag(loc.country)} {loc.name}
          </div>

          {/* WEATHER BUTTON — restored working + colored */}
          <button
            type="button"
            onPointerDown={(e) => {
              // prevent drag/parent handlers from hijacking click
              e.stopPropagation();
            }}
            onClick={openWeatherMap}
            style={{
              border: "none",
              background: weatherLoading
                ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                : weather?.condition?.toLowerCase().includes("rain")
                ? "linear-gradient(135deg,#3b82f6,#2563eb)"
                : weather?.condition?.toLowerCase().includes("thunder")
                ? "linear-gradient(135deg,#8b5cf6,#6d28d9)"
                : weather?.condition?.toLowerCase().includes("cloud")
                ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                : "linear-gradient(135deg,#f59e0b,#f97316)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
            title="Open weather map"
          >
            {weatherLoading
              ? "Weather…"
              : weather?.temperatureC != null
              ? `${weather.temperatureC}°C • ${weather.condition}`
              : "Weather"}
          </button>
        </div>

        {act.details && (
          <div style={{ marginTop: 8, color: "#374151" }}>{act.details}</div>
        )}
      </div>

      {/* RIGHT */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* PHOTO ONLY */}
        <div
          style={{
            width: "100%",
            height: 150,
            borderRadius: 10,
            overflow: "hidden",
            background: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: 14,
          }}
        >
          {isRealPhoto(act.image) ? (
            <img
              src={act.image}
              alt={act.title}
              onClick={() => setPopupImage(act.image)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                cursor: "zoom-in",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            "Photo coming soon"
          )}
        </div>

        {/* LEAFLET MAP */}
        {c && (
          <div style={{ height: 160, borderRadius: 10, overflow: "hidden" }}>
            <LeafletMap
              lat={c.lat}
              lon={c.lon}
              popup={loc.name}
              routes={singleSeg}
              user={userLocation}
            />
          </div>
        )}
      </div>
    </div>
  );
}
