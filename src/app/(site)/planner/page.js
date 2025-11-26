"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { ssr: false });

export default function PlannerPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState([]);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      setItinerary(json.itinerary || []);
    } catch (err) {
      console.error("Planner error:", err);
      setError("Failed to generate itinerary. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #f0fdfa, #e0f2fe)",
        paddingTop: "120px",
        paddingBottom: "80px",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          background: "#fff",
          padding: "24px",
          borderRadius: "16px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
        }}
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            color: "#1e3a8a",
            marginBottom: "16px",
          }}
        >
          🧭 Trip Planner
        </h1>
        <p style={{ color: "#374151", marginBottom: "20px" }}>
          Describe your trip — for example:
          <br />
          <em>&ldquo 3 days in Hanoi with food and culture on a mid budget &rdquo</em>
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. 5 days Tokyo sightseeing and sushi"
            style={{
              flex: 1,
              padding: "12px 14px",
              border: "1px solid #ccc",
              borderRadius: "10px",
              fontSize: "1rem",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              backgroundColor: "#0d9488",
              color: "#fff",
              padding: "12px 24px",
              border: "none",
              borderRadius: "10px",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        {/* Itinerary results */}
        {itinerary.length > 0 && (
          <div>
            <h2 style={{ fontSize: "1.5rem", color: "#0d9488", marginBottom: 16 }}>
              ✨ Your AI-Generated Itinerary
            </h2>

            {itinerary.map((day, i) => (
              <div
                key={i}
                style={{
                  background: "#f9fafb",
                  padding: "16px",
                  borderRadius: "10px",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ fontWeight: "bold", color: "#1e3a8a", marginBottom: "8px" }}>
                  Day {day.day}
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li>🌅 Morning: {day.am}</li>
                  <li>🌇 Afternoon: {day.pm}</li>
                  <li>🌃 Evening: {day.eve}</li>
                </ul>

                {/* Optional small map */}
                <div
                  style={{
                    height: "200px",
                    marginTop: "10px",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  <LeafletMap lat={21.0285} lon={105.8542} popup={`Day ${day.day}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && itinerary.length === 0 && (
          <p style={{ color: "#6b7280" }}>
            💡 Try typing your dream trip idea above to see an itinerary appear here.
          </p>
        )}
      </div>
    </main>
  );
}
