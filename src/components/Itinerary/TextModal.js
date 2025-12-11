"use client";

export default function TextModal({ title, content, onClose }) {
  if (!content) return null;

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
          maxWidth: 560,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          borderRadius: 14,
          padding: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          whiteSpace: "pre-wrap",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          {title}
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{content}</div>
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
