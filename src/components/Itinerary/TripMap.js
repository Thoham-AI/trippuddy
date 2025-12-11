"use client";

export default function TripMap({ itinerary, routesByDay, LeafletMap, userLocation }) {
  const allCoords = [];
  (itinerary || []).forEach((day) =>
    (day.activities || []).forEach((a) => {
      if (a.coordinates) allCoords.push([a.coordinates.lat, a.coordinates.lon]);
    })
  );

  const first = allCoords[0] || [ -25.2744, 133.7751 ];

  const allSegments = [];
  Object.values(routesByDay || {}).forEach((bundle) => {
    (bundle?.segments || []).forEach((seg) => {
      if (seg) allSegments.push(seg);
    });
  });

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
          Full Trip Route 🌏
        </div>
        <div style={{ width: "100%", height: "52vh" }}>
          <LeafletMap
            lat={first[0]}
            lon={first[1]}
            popup={"Trip route"}
            routes={allSegments}
            bounds={allCoords.length ? allCoords : null}
            user={userLocation}
          />
        </div>
      </div>
    </div>
  );
}
