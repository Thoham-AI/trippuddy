"use client";

export default function FullDayRouteMap({
  dayIndex,
  itinerary,
  routesByDay,
  fullDayBounds,
  LeafletMap,
  userLocation,
}) {
  const day = itinerary[dayIndex];
  const firstCoords = day.activities?.[0]?.coordinates || {};

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,.06)",
          padding: 10,
          border: "1px solid #eef2f7",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            marginBottom: 8,
            color: "#0f172a",
          }}
        >
          Full Day Route — Day {dayIndex + 1}
        </div>
        <div style={{ width: "100%", height: "48vh" }}>
          <LeafletMap
            lat={firstCoords.lat || 1.29}
            lon={firstCoords.lon || 103.85}
            popup={`Day ${dayIndex + 1}`}
            routes={routesByDay[dayIndex]?.segments || []}
            bounds={fullDayBounds}
            user={userLocation}
          />
        </div>
      </div>
    </div>
  );
}
