"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (no “Mark” text)
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src || markerIcon,
  iconRetinaUrl: markerIcon2x.src || markerIcon2x,
  shadowUrl: markerShadow.src || markerShadow,
});

/* ---------------- FitToBounds helper ---------------- */
function FitToBounds({ bounds }) {
  const map = useMap();
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!bounds || bounds.length <= 1) return;

    // ✅ Deduplicate bounds to prevent “zoom snaps back” on re-render
    const key = bounds
      .map((b) => {
        // bounds can be [lat, lon] arrays or LatLng-like objects
        if (Array.isArray(b)) return `${b[0].toFixed?.(6) ?? b[0]},${b[1].toFixed?.(6) ?? b[1]}`;
        const lat = b?.lat ?? b?.[0];
        const lon = b?.lng ?? b?.lon ?? b?.[1];
        return `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`;
      })
      .join("|");

    if (key && key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    map.fitBounds(bounds, {
      padding: [30, 30],
      // ✅ Keep the fit from forcing an overly-close zoom,
      // but still allow users to zoom in manually afterward.
      maxZoom: 17,
      animate: true,
    });
  }, [bounds, map]);

  return null;
}

/* ---------------- Bearing helper ---------------- */
function bearingDeg(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const λ1 = toRad(a.lng ?? a.lon);
  const λ2 = toRad(b.lng ?? b.lon);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/* ---------------- Animated emoji marker ---------------- */
function AnimatedEmoji({ path = [], mode = "drive" }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !path || path.length < 2) return;

    const latlngs = path.map(([lat, lon]) => L.latLng(lat, lon));
    const expanded = [];
    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = latlngs[i];
      const b = latlngs[i + 1];
      const dist = map.distance(a, b);
      const step = mode === "walk" ? 8 : 20;
      const n = Math.max(2, Math.floor(dist / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        expanded.push(
          L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t)
        );
      }
    }
    expanded.push(latlngs[latlngs.length - 1]);

    const emoji = mode === "walk" ? "👣" : "🚗";
    const icon = L.divIcon({
      className: "emoji-marker",
      html: `<div class="emoji-marker-inner">${emoji}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker(expanded[0], { icon }).addTo(map);

    let frameId;
    let idx = 0;
    const stepMs = 33;

    function tick() {
      const cur = expanded[idx];
      const nxt = expanded[(idx + 1) % expanded.length];
      marker.setLatLng(cur);

      const el = marker.getElement()?.querySelector(".emoji-marker-inner");
      if (el) {
        const angle = bearingDeg(cur, nxt);
        el.style.transform = `rotate(${angle}deg)`;
      }

      idx = (idx + 1) % expanded.length;
      frameId = setTimeout(() => requestAnimationFrame(tick), stepMs);
    }

    frameId = requestAnimationFrame(tick);
    return () => {
      clearTimeout(frameId);
      marker.remove();
    };
  }, [map, path, mode]);

  return null;
}

/* ---------------- Main component ---------------- */
export default function LeafletMap({
  lat,
  lon,
  popup,
  routes = [],
  bounds = null,
  user = null,
}) {
  // Ensure zoom controls stay above other UI
  useEffect(() => {
    const ctr = document.querySelector(".leaflet-control-container");
    if (ctr) ctr.style.zIndex = "10000";
  }, []);

  const animatedPath = routes.filter(Boolean).flatMap((seg) => seg.latlngs || []);
  const animMode = routes[0]?.mode || "drive";

  return (
    <div
      // ✅ Prevent DnD-kit from hijacking map events
      onPointerDownCapture={(e) => e.stopPropagation()}
      onMouseDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        pointerEvents: "auto",
        zIndex: 10,
      }}
    >
      <MapContainer
        center={[lat, lon]}
        zoom={15}
        minZoom={2}
        maxZoom={19}              // ✅ allow zoom-in
        scrollWheelZoom={true}
        zoomControl={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
        boxZoom={true}
        keyboard={true}
        style={{
          height: "100%",
          width: "100%",
          borderRadius: "10px",
          overflow: "hidden",
          position: "relative",
        }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maxZoom={19}            // ✅ match container maxZoom
        />

        {/* Main POI marker */}
        <Marker position={[lat, lon]}>
          <Popup>
            <b>{popup}</b>
          </Popup>
        </Marker>

        {/* Optional user marker */}
        {user && user.lat && user.lon && (
          <CircleMarker
            center={[user.lat, user.lon]}
            radius={6}
            color="#2563eb"
            fillColor="#3b82f6"
            fillOpacity={0.95}
            weight={2}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              You are here
            </Tooltip>
          </CircleMarker>
        )}

        {/* Fit bounds when provided */}
        {bounds && <FitToBounds bounds={bounds} />}

        {/* Route polylines */}
        {routes.filter(Boolean).map((seg, i) => {
          const isWalk = seg.mode === "walk";
          return (
            <Polyline
              key={i}
              positions={seg.latlngs}
              pathOptions={{
                color: isWalk ? "#22c55e" : "#fb923c",
                weight: isWalk ? 3 : 5,
                opacity: 0.95,
                smoothFactor: 1.5,
                lineCap: "round",
                lineJoin: "round",
                dashArray: isWalk ? "6,10" : undefined,
              }}
            >
              <Tooltip sticky>
                {isWalk ? "🚶 Walking segment" : "🚕 Driving segment"}
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Animated emoji following path */}
        {animatedPath.length > 1 && (
          <AnimatedEmoji
            path={animatedPath}
            mode={animMode === "walk" ? "walk" : "drive"}
          />
        )}
      </MapContainer>
    </div>
  );
}

/* ---------- Global styles ---------- */
<style jsx global>{`
  .emoji-marker {
    pointer-events: none;
  }
  .emoji-marker-inner {
    font-size: 20px;
    line-height: 20px;
    transform-origin: center center;
    will-change: transform;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.25);
  }

  /* ✅ Ensure Leaflet controls are always clickable */
  .leaflet-control-zoom {
    z-index: 10000 !important;
    pointer-events: auto !important;
  }
  .leaflet-pane,
  .leaflet-top,
  .leaflet-bottom {
    pointer-events: auto !important;
  }
  .leaflet-container {
    touch-action: pan-x pan-y;
  }
`}</style>
