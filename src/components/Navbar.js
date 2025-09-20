"use client";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav
      style={{
        background: "#1e3a8a", // deep blue
        color: "#fff",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      {/* Logo */}
      <div style={{ fontWeight: "bold", fontSize: 30 }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none" }}>
          TravelAI
        </Link>
      </div>

      {/* Navigation links */}
      <div style={{ display: "flex", gap: 24 }}>
        {["Home", "Destinations", "About", "Contact"].map((item) => (
          <Link
            key={item}
            href={item === "Home" ? "/" : `/${item.toLowerCase()}`}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              fontWeight: 500,
              fontSize: "20px", // Increased font size
              color: "#facc15", // bright yellow
              textDecoration: "none",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {item}
          </Link>
        ))}
      </div>
    </nav>
  );
}