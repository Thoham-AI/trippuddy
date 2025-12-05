"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);
  const router = useRouter();

  // Fake notification (simulated)
  useEffect(() => {
    setTimeout(() => setHasNotification(true), 4000);
  }, []);

  return (
    <nav
      style={{
        background: "#1e3a8a",
        color: "#fff",
        padding: "12px 26px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      }}
    >
      {/* LOGO + NAME */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
        }}
      >
        <div
          style={{ transition: "transform 0.4s ease" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "rotate(360deg)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.transform = "rotate(0deg)")
          }
        >
          <Image src="/logo.png" alt="TripPuddy Logo" width={42} height={42} />
        </div>

        <Link
          href="/"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontSize: 32,
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          TripPuddy
        </Link>
      </div>

      {/* NAVIGATION BUTTONS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <Link href="/" style={navLinkStyle}>
          Home
        </Link>

        <Link href="/itinerary" style={navLinkStyle}>
          Itinerary
        </Link>

        <Link href="/about" style={navLinkStyle}>
          About
        </Link>

        <Link href="/contact" style={navLinkStyle}>
          Contact
        </Link>

        {/* ⭐ NEW — CHAT BUTTON */}
        <Link href="/chat" style={navLinkStyle}>
          Chat
        </Link>

        {/* 🔔 Notification Bell → route to chat */}
        <div
          onClick={() => {
            setHasNotification(false);
            router.push("/chat");
          }}
          style={{
            position: "relative",
            cursor: "pointer",
            fontSize: 30,
            padding: "4px 10px",
            transition: "0.3s",
            color: hasNotification ? "#facc15" : "#ffffff",
            animation: hasNotification ? "shake 0.4s ease-in-out" : "none",
          }}
        >
          🔔

          {/* Red unread dot */}
          {hasNotification && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 5,
                width: 10,
                height: 10,
                background: "#ef4444",
                borderRadius: "50%",
                boxShadow: "0 0 6px rgba(0,0,0,0.4)",
              }}
            ></span>
          )}
        </div>

        <Link
          href="/login"
          style={{
            padding: "12px 30px",
            background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
            borderRadius: "32px",
            fontSize: "22px",
            fontWeight: "600",
            color: "white",
            textDecoration: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 8px rgba(0,0,0,0.25)",
          }}
        >
          Login
        </Link>
      </div>

      {/* Bell Shake Animation */}
      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          50% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </nav>
  );
}

const navLinkStyle = {
  padding: "8px 14px",
  borderRadius: 6,
  fontWeight: 500,
  fontSize: "22px",
  color: "#facc15",
  textDecoration: "none",
  transition: "all 0.3s ease",
  whiteSpace: "nowrap",
};
