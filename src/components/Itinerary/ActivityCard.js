"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------
   Google Maps–style pin icon (inline, no external dependency)
-------------------------------------------------------------------*/
function GoogleMapPinIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="currentColor"
      />
      <circle cx="12" cy="9" r="2.5" fill="#ffffff" />
    </svg>
  );
}

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

  // Weather state (per activity coordinates)
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
          {/* CLICKABLE PIN PILL (colored) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const website =
                act?.website ||
                act?.url ||
                act?.link ||
                loc?.website ||
                loc?.url ||
                loc?.link ||
                null;

              if (website && typeof website === "string") {
                const safeUrl = website.startsWith("http")
                  ? website
                  : `https://${website}`;
                window.open(safeUrl, "_blank", "noopener,noreferrer");
                return;
              }

              const lat = c?.lat;
              const lon = c?.lon;
              const label = encodeURIComponent(act.title || loc.name || "Destination");

              const url =
                typeof lat === "number" && typeof lon === "number"
                  ? `https://www.google.com/maps?q=${lat},${lon}(${label})`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${act.title || ""} ${loc.name || ""} ${loc.country || ""}`.trim()
                    )}`;

              window.open(url, "_blank", "noopener,noreferrer");
            }}
            style={{
              border: "none",
              background: "linear-gradient(135deg,#ec4899,#db2777)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            title="Open official website (or Google Maps)"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <GoogleMapPinIcon size={16} />
              Website / Map
            </span>
          </button>

          {/* WEATHER BUTTON (unchanged) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const lat = c?.lat;
              const lon = c?.lon;

              if (typeof lat === "number" && typeof lon === "number") {
                const label = encodeURIComponent(act.title || loc.name || "Location");
                const url = `/weather-map?lat=${lat}&lon=${lon}&label=${label}`;
                window.open(url, "_blank", "noopener,noreferrer");
              }
            }}
            style={{
              border: "none",
              background: weatherLoading
                ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                : weather?.condition?.toLowerCase().includes("rain")
                ? "linear-gradient(135deg,#3b82f6,#2563eb)"
                : weather?.condition?.toLowerCase().includes("cloud")
                ? "linear-gradient(135deg,#9ca3af,#6b7280)"
                : "linear-gradient(135deg,#f59e0b,#f97316)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
            title="View detailed weather on OpenWeather map"
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
