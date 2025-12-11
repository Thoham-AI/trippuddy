"use client";

export default function BudgetSummary({ breakdown, onClose }) {
  if (!breakdown) return null;

  const { perDay, total } = breakdown;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 20,
          minWidth: 320,
          maxWidth: 480,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
          Trip Budget Summary 💰
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {perDay.map((d) => (
            <li
              key={d.day}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <span>Day {d.day}</span>
              <span>${d.total.toFixed(0)} AUD</span>
            </li>
          ))}
        </ul>
        <hr style={{ margin: "10px 0" }} />
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Total trip</span>
          <span>${total.toFixed(0)} AUD</span>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "8px 0",
            borderRadius: 10,
            border: "none",
            background: "#0ea5e9",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
