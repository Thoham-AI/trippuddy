export default function DestinationCard({ destination }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <img
        src={destination.image}
        alt={destination.name}
        style={{
          width: "100%",
          height: 140,         // fixed height
          objectFit: "cover",  // crops nicely
        }}
      />
      <div style={{ padding: "12px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
          {destination.name}
        </h2>
        <p style={{ fontSize: 14, color: "#555" }}>
          {destination.description || "Discover this amazing place..."}
        </p>
      </div>
    </div>
  );
}
