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
import { useEffect } from "react";
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

// ---- helpers ----
function FitToBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [bounds, map]);
  return null;
}

// Bearing (degrees) from A -> B
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

// Create & animate a rotating emoji marker along a path
function AnimatedEmoji({ path = [], mode = "drive" }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !path || path.length < 2) return;

    // Build an expanded list of points for smooth animation
    const latlngs = path.map(([lat, lon]) => L.latLng(lat, lon));
    const expanded = [];
    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = latlngs[i];
      const b = latlngs[i + 1];
      const dist = map.distance(a, b); // meters
      const step = mode === "walk" ? 8 : 20; // meters per substep
      const n = Math.max(2, Math.floor(dist / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        expanded.push(
          L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t)
        );
      }
    }
    expanded.push(latlngs[latlngs.length - 1]);

    // Emoji + rotate inner span so we don't fight Leaflet translate transforms
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

    const stepMs = 33; // ~30 FPS
    function tick() {
      const cur = expanded[idx];
      const nxt = expanded[(idx + 1) % expanded.length];

      marker.setLatLng(cur);

      // rotate inner div to match bearing
      const el = marker.getElement()?.querySelector(".emoji-marker-inner");
      if (el) {
        const angle = bearingDeg(cur, nxt);
        // rotate the inner, keep translate from Leaflet
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

export default function LeafletMap({
  lat,
  lon,
  popup,
  routes = [],      // [{ mode: "walk"|"drive", latlngs: [[lat,lon], ...] }]
  bounds = null,    // [[lat,lon], ...] (optional)
  user = null,      // { lat, lon } (optional, NOT routed)
}) {
  // keep controls clickable above UI
  useEffect(() => {
    const ctr = document.querySelector(".leaflet-control-container");
    if (ctr) ctr.style.zIndex = "10000";
  }, []);

  // Build one continuous path for the animation (use all segments)
  const animatedPath = routes
    .filter(Boolean)
    .flatMap((seg) => seg.latlngs || []);

  // Choose animation mode from first segment (fallback to drive)
  const animMode = routes[0]?.mode || "drive";

  return (
    <MapContainer
      center={[lat, lon]}
      zoom={15}
      zoomControl={true}
      scrollWheelZoom={true}
      style={{
        height: "100%",
        width: "100%",
        borderRadius: "10px",
        overflow: "hidden",
        position: "relative",
        zIndex: 10,
      }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />

      {/* Main POI marker */}
      <Marker position={[lat, lon]}>
        <Popup>
          <b>{popup}</b>
        </Popup>
      </Marker>

      {/* Optional user location (not routed) */}
      {user && user.lat && user.lon && (
        <CircleMarker
          center={[user.lat, user.lon]}
          radius={6}
          color="#2563eb"
          fillColor="#3b82f6"
          fillOpacity={0.95}
          weight={2}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={false}>
            You are here
          </Tooltip>
        </CircleMarker>
      )}

      {/* Fit to bounds (full-day map) */}
      {bounds && <FitToBounds bounds={bounds} />}

      {/* Draw route segments with smooth, Google-like look */}
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
              smoothFactor: 1.5,  // <- smooth, rounded feel
              lineCap: "round",
              lineJoin: "round",
              dashArray: isWalk ? "6,10" : null, // dashed for walking
            }}
          >
            <Tooltip sticky>
              {isWalk ? "🚶 Walking segment" : "🚕 Driving segment"}
            </Tooltip>
          </Polyline>
        );
      })}

      {/* Animated rotating emoji marker following the full path */}
      {animatedPath.length > 1 && (
        <AnimatedEmoji path={animatedPath} mode={animMode === "walk" ? "walk" : "drive"} />
      )}
    </MapContainer>
  );
}

/* global styles for the emoji marker */
<style jsx global>{`
  .emoji-marker { pointer-events: none; }
  .emoji-marker-inner {
    font-size: 20px;
    line-height: 20px;
    transform-origin: center center;
    will-change: transform;
    text-shadow: 0 0 2px rgba(0,0,0,.25);
  }
`}</style>
