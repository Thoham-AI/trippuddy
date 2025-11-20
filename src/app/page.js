"use client";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  const sendHomeChat = () => {
    const input = document.getElementById("homeChatInput");
    if (!input.value.trim()) return;
    window.location.href = `/chat?msg=${encodeURIComponent(input.value)}`;
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #e0f2fe, #f0fdfa)",
        paddingTop: "0px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Banner Image */}
      <div style={{ width: "100%", maxHeight: "260px", overflow: "hidden" }}>
        <Image
          src="/banner.jpg"
          alt="Travel Banner"
          width={2000}
          height={400}
          style={{
            width: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </div>

      {/* Hero Section */}
      <h1
        style={{
          fontSize: "2.4rem", // ↓ reduced from 3rem
          fontWeight: "bold",
          color: "#1e3a8a",
          marginTop: "10px", // ↓ tighter spacing
          lineHeight: 1.15,
        }}
      >
        Plan your next adventure with{" "}
        <span style={{ color: "#0d9488" }}>TripPuddy</span> ✈️
      </h1>

      <p
        style={{
          maxWidth: "640px",
          marginTop: "6px", // ↓ moved up closer to headline
          fontSize: "1.1rem",
          color: "#374151",
          lineHeight: 1.5,
        }}
      >
        Your AI travel companion that crafts unique itineraries and routes in seconds - 
        just tell it your destination, mood, and budget.
      </p>

      {/* Inline Chat Prompt */}
      <div
        style={{
          marginTop: "24px",  // ↓ reduced space so chat field appears instantly
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#ffffff",
            borderRadius: "14px",
            padding: "14px 18px",
            width: "75%",
            maxWidth: "720px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            border: "1px solid #e5e7eb",
            gap: "12px",
          }}
        >
          <input
            id="homeChatInput"
            type="text"
            placeholder="Ask TripPuddy anything about your trip..."
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              fontSize: "1.1rem",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendHomeChat();
            }}
          />

          <button
            onClick={sendHomeChat}
            style={{
              padding: "10px 26px",
              background: "#0d9488",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontSize: "1.05rem",
              cursor: "pointer",
              fontWeight: "600",
              whiteSpace: "nowrap",
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Chat + Itinerary buttons */}
      <div
        style={{
          marginTop: "16px",  // ↓ reduced space below chat bar
          display: "flex",
          gap: "20px",
          justifyContent: "center",
        }}
      >
        <Link
          href="/chat"
          style={{
            padding: "12px 28px",
            background: "#0d9488",
            borderRadius: "25px",
            fontSize: "20px",
            color: "white",
            fontWeight: "600",
            textDecoration: "none",
            boxShadow: "0 2px 4px rgba(0,0,0,0.18)",
          }}
        >
          💬 Chat
        </Link>

        <Link
          href="/itinerary"
          style={{
            padding: "12px 28px",
            background: "#1e3a8a",
            borderRadius: "25px",
            fontSize: "20px",
            color: "#facc15",
            fontWeight: "600",
            textDecoration: "none",
            boxShadow: "0 2px 4px rgba(0,0,0,0.18)",
          }}
        >
          🗺️ Itinerary
        </Link>
      </div>

      {/* Featured Trips */}
      <div
        style={{
          marginTop: "60px", // ↓ slight reduction from 80px
          width: "90%",
          maxWidth: "1000px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
        }}
      >
        {[
          {
            name: "🌴 Bali Escape",
            desc: "Relax by the beaches and rice terraces for a 4-day getaway.",
          },
          {
            name: "🏯 Kyoto Adventure",
            desc: "Experience temples, matcha cafes, and hidden streets of Japan.",
          },
          {
            name: "🗺️ Hanoi Food Trip",
            desc: "Street food, old quarters, and warm culture — all in one weekend.",
          },
        ].map((trip, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "scale(1.03)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "scale(1.0)")
            }
          >
            <h3
              style={{
                color: "#0d9488",
                fontWeight: "bold",
                fontSize: "1.25rem",
              }}
            >
              {trip.name}
            </h3>
            <p style={{ color: "#374151", marginTop: "6px" }}>{trip.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
