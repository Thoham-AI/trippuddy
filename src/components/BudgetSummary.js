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
        background: "rgba(0,0,0,0.55)",
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
          maxWidth: 420,
          boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 10,
            color: "#0f172a",
          }}
        >
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

        <hr style={{ margin: "12px 0" }} />

        <div
          style={{
            fontWeight: 900,
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
            marginTop: 16,
            width: "100%",
            padding: "10px",
            borderRadius: 10,
            background: "#0ea5e9",
            border: "none",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
