"use client";

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
  console.log("IMAGE URL:", act.image);
  const c = coordinates;

  const weatherLink =
    act.weather?.link || act.weatherLink || act.weather?.url || null;
  const weatherTemp = act.weather?.temp ?? act.weatherTemp ?? null;
  const weatherDesc = act.weather?.description ?? act.weatherDesc ?? "";
  const weatherIcon = act.weather?.icon || act.weatherIcon || null;

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
        position: "relative",
        border: "1px solid #eef2f7",
      }}
    >
      {/* LEFT */}
      <div className="left">
        <div className="title" style={{ fontSize: 18, fontWeight: 700 }}>
          <b>{act.time || "Flexible"}</b> — {act.title}
        </div>

        {(act.arrival_time ||
          act.durationMinutes ||
          act.departure_time) && (
          <div
            className="timing"
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#4b5563",
              fontWeight: 500,
            }}
          >
            {act.arrival_time && <span>Arrive {act.arrival_time}</span>}
            {act.durationMinutes && (
              <span>
                {act.arrival_time ? " · " : ""}
                Stay ~{act.durationMinutes} min
              </span>
            )}
            {act.departure_time && (
              <span>
                {(act.arrival_time || act.durationMinutes) ? " · " : ""}
                Leave {act.departure_time}
              </span>
            )}
          </div>
        )}

        <div
          className="loc"
          style={{
            marginTop: 6,
            fontSize: 15,
            color: "#111827",
          }}
        >
          <span style={{ marginRight: 6 }}>📍</span>
          <span
            className="flag"
            style={{
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            {flag(loc.country)}{" "}
          </span>
          {loc.name}
          {act.link && (
            <a
              href={act.link}
              target="_blank"
              rel="noopener noreferrer"
              title="Open website or Google Maps"
              style={{
                marginLeft: 8,
                textDecoration: "none",
                fontSize: 18,
                cursor: "pointer",
                opacity: 0.9,
              }}
            >
              🌐
            </a>
          )}
        </div>

        {weatherTemp !== null && (
          <div
            className="weather"
            role={weatherLink ? "button" : undefined}
            onClick={() => {
              if (weatherLink) window.open(weatherLink, "_blank");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
              color: "#0ea5e9",
              fontWeight: 700,
              cursor: weatherLink ? "pointer" : "default",
              textDecoration: weatherLink ? "underline" : "none",
            }}
          >
            {weatherIcon && (
              <img
                src={`https://openweathermap.org/img/wn/${weatherIcon}@2x.png`}
                style={{ width: 32, height: 32 }}
                alt="Weather icon"
              />
            )}
            <span>
              {Math.round(weatherTemp)}°C — {weatherDesc}
            </span>
          </div>
        )}

        {act.details && (
          <div
            className="details"
            style={{
              marginTop: 8,
              color: "#374151",
            }}
          >
            {act.details}
          </div>
        )}

        {act.cost_estimate && (
          <div
            className="cost"
            style={{
              marginTop: 6,
              color: "#15803d",
              fontWeight: 700,
            }}
          >
            💰 {act.cost_estimate}
          </div>
        )}

        {/* AI buttons */}
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => onSuggestAlternative?.(act, loc)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: "#e2e8f0",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✨ Alternative
          </button>
          <button
            onClick={() => onFoodSuggestions?.(act, loc)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: "#f97316",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🍽 Nearby food
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div
        className="right"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* ACTIVITY IMAGE */}
{isRealPhoto(act.image) && (
  <img
    src={act.image}
    alt={act.title}
    onClick={() => setPopupImage(act.image)}
    style={{
      width: "100%",
      height: 150,
      objectFit: "cover",
      borderRadius: 10,
      cursor: "zoom-in",
    }}
  />
)}


        {/* MINI MAP */}
        {c && (
          <div
            className="mapWrap"
            style={{
              position: "relative",
              zIndex: 5,
              overflow: "hidden",
              borderRadius: 10,
              height: 160,
              outline: "1px solid #f0f2f6",
            }}
          >
            <LeafletMap
              lat={c.lat}
              lon={c.lon}
              popup={loc.name}
              routes={singleSeg}
              user={userLocation}
            />
          </div>
        )}

        {/* TRAVEL BADGE */}
        {act.travelTime && mode && (
          <div
            className="travelBadge"
            style={{
              background: "#1e3a8a",
              color: "#fff",
              padding: "6px 12px",
              fontSize: 14,
              borderRadius: 18,
              width: "fit-content",
              fontWeight: 800,
            }}
          >
            {iconFor(mode)} {act.travelTime}
          </div>
        )}
      </div>
    </div>
  );
}
