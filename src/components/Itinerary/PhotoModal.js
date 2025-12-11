"use client";

export default function PhotoModal({ image, onClose }) {
  if (!image) return null;

  return (
    <div
      className="overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        cursor: "zoom-out",
      }}
    >
      <img
        className="modalImg"
        src={image}
        alt="full"
        style={{
          maxWidth: "92%",
          maxHeight: "92%",
          borderRadius: "12px",
          boxShadow: "0 0 24px rgba(0,0,0,0.4)",
          transition: "transform 0.25s ease",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.transform = "scale(1.02)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.transform = "scale(1.0)")
        }
      />
    </div>
  );
}
