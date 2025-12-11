"use client";

export default function DayHeaderControls({
  itinerary,
  activeDay,
  setActiveDay,
  daySummary,
  optimizeActiveDay,
  optimizeLabel,
  showOptimizeRecommend,
  showRouteMap,
  toggleRouteMap,
  exportCSV,
  exportPdf,
  onSaveTrip,
  onLoadTrip,
  onShowBudget,
  onGeneratePackingList,
  onToggleTripMap,
  showTripMap,
  onShareLink,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 22,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {itinerary.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: activeDay === i ? "#1e3a8a" : "#e2e8f0",
              color: activeDay === i ? "#fff" : "#1e293b",
              border: "none",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            Day {i + 1}
          </button>
        ))}
      </div>

      <div style={{ marginLeft: "auto", fontWeight: 700, color: "#334155" }}>
        📅 {daySummary(activeDay)}
      </div>

      <button
        onClick={optimizeActiveDay}
        style={{
          background: showOptimizeRecommend ? "#0ea5e9" : "#e2e8f0",
          color: showOptimizeRecommend ? "#fff" : "#1e293b",
          border: "none",
          padding: "9px 14px",
          borderRadius: 10,
          fontWeight: 700,
          fontSize: "0.9rem",
        }}
      >
        {optimizeLabel}
      </button>

      <button
        onClick={toggleRouteMap}
        style={{
          background: "#facc15",
          color: "#1e3a8a",
          padding: "9px 14px",
          borderRadius: 10,
          fontWeight: 900,
          border: "none",
        }}
      >
        {showRouteMap ? "Hide Day Map" : "Show Day Map"}
      </button>

      <button
        onClick={onToggleTripMap}
        style={{
          background: showTripMap ? "#0f766e" : "#d1fae5",
          color: showTripMap ? "#ecfeff" : "#0f766e",
          padding: "9px 14px",
          borderRadius: 10,
          border: "none",
          fontWeight: 700,
          fontSize: "0.9rem",
        }}
      >
        {showTripMap ? "Hide Trip Map" : "Full Trip Map"}
      </button>

      <button
        onClick={exportCSV}
        style={{
          padding: "9px 14px",
          borderRadius: 10,
          background: "#e2e8f0",
          color: "#1e293b",
          fontWeight: 700,
          border: "1px solid #cbd5e1",
        }}
      >
        Export CSV
      </button>

      <button
        onClick={exportPdf}
        title="Export itinerary as PDF"
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          background: "#0ea5e9",
          color: "#fff",
          fontWeight: 700,
          border: "none",
        }}
      >
        🧾 PDF
      </button>

      <button
        onClick={onShowBudget}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          background: "#f97316",
          color: "#fff",
          fontWeight: 700,
          border: "none",
        }}
      >
        💰 Budget
      </button>

      <button
        onClick={onGeneratePackingList}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          background: "#22c55e",
          color: "#fff",
          fontWeight: 700,
          border: "none",
        }}
      >
        🎒 Packing list
      </button>

      <button
        onClick={onSaveTrip}
        style={{
          padding: "7px 10px",
          borderRadius: 8,
          background: "#e5e7eb",
          color: "#111827",
          fontSize: 12,
          fontWeight: 700,
          border: "none",
        }}
      >
        💾 Save
      </button>

      <button
        onClick={onLoadTrip}
        style={{
          padding: "7px 10px",
          borderRadius: 8,
          background: "#e5e7eb",
          color: "#111827",
          fontSize: 12,
          fontWeight: 700,
          border: "none",
        }}
      >
        📂 Load
      </button>

      <button
        onClick={onShareLink}
        style={{
          padding: "7px 10px",
          borderRadius: 8,
          background: "#0f172a",
          color: "#f9fafb",
          fontSize: 12,
          fontWeight: 700,
          border: "none",
        }}
      >
        🔗 Share
      </button>
    </div>
  );
}
