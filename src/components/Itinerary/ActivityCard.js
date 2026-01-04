"use client";

import { useEffect, useRef, useState } from "react";

/* Google Maps–style pin icon (inline, no dependency) */
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
  return !String(url).includes("maps.googleapis.com/maps/api/staticmap");
};

function ensureHttp(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  return u.startsWith("http") ? u : `https://${u}`;
}

export default function ActivityCard(props) {
  /**
   * ✅ Compatibility + crash-proofing:
   * - Old callsite: <ActivityCard act={...} loc={...} coordinates={...} ... />
   * - New callsite: <ActivityCard activity={...} />
   */
  const act = props.activity ?? props.act ?? {};
  const loc = props.loc ?? act.location ?? {};
  const coordinates = props.coordinates ?? act.coordinates ?? act.coords ?? null;

  const LeafletMap = props.LeafletMap; // may be undefined (handle below)
  const userLocation = props.userLocation ?? null;
  const singleSeg = props.singleSeg ?? null;
  const setPopupImage = props.setPopupImage;

  const c = coordinates;

  /* ---------------- WEATHER (unchanged) ---------------- */
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

  // Strong event shielding against parent overlays / DnD handlers
  // IMPORTANT: do NOT preventDefault for links; only stopPropagation.
  const stopOnly = (e) => {
    e.stopPropagation();
  };

  // ✅ Zoom helper (popup if available, else new tab)
  const zoomImage = (url) => {
    if (!url) return;

    if (typeof setPopupImage === "function") {
      setPopupImage(url);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ✅ Compute Website/Map final href (official website first)
  const website = ensureHttp(
    act?.website || loc?.website || act?.link || loc?.link || ""
  );

  const mapsUrl = ensureHttp(
    act?.mapsUrl || loc?.mapsUrl || act?.url || loc?.url || ""
  );

  const lat = c?.lat;
  const lon = c?.lon;

  const label = encodeURIComponent(
    (act?.title ?? loc?.name ?? "Location").toString()
  );

  const fallbackMaps =
    typeof lat === "number" && typeof lon === "number"
      ? `https://www.google.com/maps?q=${lat},${lon}(${label})`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${act?.title || ""} ${loc?.name || ""} ${loc?.country || ""}`.trim()
        )}`;

  const websiteOrMapHref = website || mapsUrl || fallbackMaps;

  // ✅ Weather URL (unchanged destination, just link-based)
  const weatherHref =
    typeof lat === "number" && typeof lon === "number"
      ? `https://openweathermap.org/weathermap?basemap=map&layers=temperature&lat=${lat}&lon=${lon}&zoom=12`
      : "";

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
          <b>{act?.time || "Flexible"}</b> — {act?.title || loc?.name || "Activity"}
        </div>

        {/* Buttons under title (left) */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 10,
          }}
        >
          {/* ✅ WEBSITE / MAP as LINK (prevents popup-blocking) */}
          <a
            href={websiteOrMapHref}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDownCapture={stopOnly}
            onMouseDownCapture={stopOnly}
            onClickCapture={stopOnly}
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
              pointerEvents: "auto",
              position: "relative",
              zIndex: 50,
              textDecoration: "none",
            }}
            title={website ? "Open official website" : "Open map"}
          >
            <GoogleMapPinIcon size={16} />
            Website / Map
          </a>

          {/* ✅ WEATHER as LINK (same reason) */}
          <a
            href={weatherHref || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDownCapture={stopOnly}
            onMouseDownCapture={stopOnly}
            onClickCapture={stopOnly}
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
              pointerEvents: "auto",
              position: "relative",
              zIndex: 50,
              textDecoration: "none",
              opacity: weatherHref ? 1 : 0.6,
            }}
            title="Open weather map"
          >
            {weatherLoading
              ? "Weather…"
              : weather?.temperatureC != null
              ? `${weather.temperatureC}°C • ${weather.condition}`
              : "Weather"}
          </a>
        </div>

        {act?.details && (
          <div style={{ marginTop: 12, color: "#374151" }}>{act.details}</div>
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
          {isRealPhoto(act?.image) ? (
            <img
              src={act.image}
              alt={act?.title || loc?.name || "Photo"}
              onPointerDownCapture={stopOnly}
              onMouseDownCapture={stopOnly}
              onClickCapture={(e) => {
                stopOnly(e);
                zoomImage(act.image);
              }}
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

        {/* ✅ Only render map if LeafletMap exists */}
        {c && typeof LeafletMap === "function" && (
          <div style={{ height: 160, borderRadius: 10, overflow: "hidden" }}>
            <LeafletMap
              lat={c.lat}
              lon={c.lon}
              popup={loc?.name || act?.title || ""}
              routes={singleSeg}
              user={userLocation}
            />
          </div>
        )}
      </div>
    </div>
  );
}
