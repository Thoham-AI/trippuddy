"use client";

import { useState } from "react";
import DestinationCard from "../components/DestinationCard";

export default function HomePage() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState(""); // new state for AI prompt

  const generateDestinations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }), // send prompt to backend
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDestinations(data || []);
    } catch (err) {
      console.error(err);
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  };

  const container = { maxWidth: 1100, margin: "24px auto", padding: "0 16px" };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div style={container}>
        {/* Banner */}
        <div
          style={{
            width: "100%",
            height: 420,
            borderRadius: 8,
            overflow: "hidden",
            position: "relative",
            marginBottom: 28,
            backgroundColor: "#ddd",
          }}
        >
          <img
            src="/images/banner.jpg"
            alt="Banner"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => (e.currentTarget.src = "/fallback.jpg")}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.35)",
              color: "#fff",
              textAlign: "center",
              padding: 12,
            }}
          >
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
              Explore Amazing Destinations
            </h1>
          </div>
        </div>

        {/* AI Prompt Box */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <input
            type="text"
            placeholder="Type your travel prompt... e.g. Sunny beaches in Asia"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{
              flex: 1,
              maxWidth: 600,
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 16,
              outline: "none",
            }}
          />
          <button
            onClick={generateDestinations}
            disabled={loading}
            style={{
              background: "#facc15",
              color: "#1e3a8a",
              padding: "12px 20px",
              fontSize: 16,
              borderRadius: 8,
              border: "none",
              cursor: loading ? "default" : "pointer",
              fontWeight: 600,
              boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
            }}
          >
            {loading ? "Loading..." : "Generate"}
          </button>
        </div>

        {/* Grid for generated pictures */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {destinations.map((dest) => (
            <DestinationCard key={dest.name} destination={dest} />
          ))}
        </div>
      </div>
    </div>
  );
}
