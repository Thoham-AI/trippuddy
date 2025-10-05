"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import Papa from "papaparse";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ destinations: [], itinerary: [] });

  // --- Call API ---
  const generateItinerary = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      let json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setData({ destinations: [], itinerary: [] });
    } finally {
      setLoading(false);
    }
  };

  // --- Export PDF ---
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Travel Itinerary", 14, 20);

    let y = 30;

    // Destinations
    doc.setFontSize(14);
    doc.text("Destinations:", 14, y);
    y += 10;
    data.destinations.forEach((d, i) => {
      doc.text(`${i + 1}. ${d.name} (${d.country}) - ${d.description}`, 14, y);
      y += 8;
    });

    // Itinerary
    y += 10;
    doc.setFontSize(14);
    doc.text("Itinerary:", 14, y);
    y += 10;
    data.itinerary.forEach((day) => {
      doc.setFontSize(13);
      doc.text(`${day.date || `Day ${day.day}`}:`, 14, y);
      y += 8;

      day.activities.forEach((act) => {
        doc.setFontSize(11);
        doc.text(`⏰ ${act.time} | ${act.title}`, 20, y);
        y += 6;
        doc.text(`📍 ${act.location}`, 24, y);
        y += 6;
        doc.text(`💰 ${act.cost_estimate}`, 24, y);
        y += 6;
        if (act.details) {
          doc.text(`${act.details}`, 24, y);
          y += 8;
        }
        if (act.link) {
          doc.text(`🔗 ${act.link}`, 24, y);
          y += 8;
        }
        y += 4;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      y += 8;
    });

    doc.save("detailed_itinerary.pdf");
  };

  // --- Export CSV ---
  const exportCSV = () => {
    const rows = [];

    // Destinations
    rows.push(["Destinations"]);
    rows.push(["Name", "Country", "Description", "Image"]);
    data.destinations.forEach((d) => {
      rows.push([d.name, d.country, d.description, d.image]);
    });

    rows.push([]);
    rows.push(["Itinerary"]);
    rows.push([
      "Day",
      "Date",
      "Time",
      "Title",
      "Location",
      "Details",
      "Cost Estimate",
      "Link",
      "Image",
    ]);

    data.itinerary.forEach((day) => {
      day.activities.forEach((act) => {
        rows.push([
          day.day,
          day.date || "",
          act.time,
          act.title,
          act.location,
          act.details,
          act.cost_estimate,
          act.link,
          act.image,
        ]);
      });
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "detailed_itinerary.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const container = { maxWidth: 1100, margin: "24px auto", padding: "0 16px" };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div style={container}>
        {/* Banner */}
        <div
          style={{
            width: "100%",
            height: 380,
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
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
              AI Travel Planner
            </h1>
          </div>
        </div>

        {/* Prompt Box */}
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
            placeholder="Type your travel request... e.g. 4 days in Darwin"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateItinerary()}
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
            onClick={generateItinerary}
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

        {/* Export Buttons */}
        {data.itinerary.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <button
              onClick={exportPDF}
              style={{
                background: "#1e3a8a",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              Export PDF
            </button>
            <button
              onClick={exportCSV}
              style={{
                background: "#15803d",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              Export CSV
            </button>
          </div>
        )}

        {/* Destinations */}
        {data.destinations.length > 0 && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
              Suggested Destinations
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {data.destinations.map((dest, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    overflow: "hidden",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  }}
                >
		<img
		  src={dest.image}
		  alt={dest.name}
		  style={{
		    width: "100%",
		    maxWidth: 900, // limit width (try 800–1000 for best fit)
		    height: 140,
		    objectFit: "contain", // show the full image
		    display: "block",
		    margin: "0 auto",
		    borderRadius: 12,
		    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
		  }}
  		  onError={(e) => (e.currentTarget.src = "/fallback.jpg")}
		/>
		<div style={{ padding: 12 }}>
  		  <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{dest.name}</h3>
  		  <p style={{ margin: 0, fontSize: 14, color: "#555" }}>{dest.description}</p>
		</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Itinerary */}
        {data.itinerary.length > 0 && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
              Travel Itinerary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {data.itinerary.map((day, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    padding: 16,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  }}
                >
                  <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>
                    {day.date || `Day ${day.day}`}
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {day.activities.map((act, i) => (
                      <li
                        key={i}
                        style={{
                          marginBottom: 16,
                          fontSize: 15,
                          listStyle: "none",
                        }}
                      >
                        {/* Image */}
                        {act.image && (
                          <img
                            src={act.image}
                            alt={act.title}
                            style={{
                              width: "100%",
                              height: 180,
                              objectFit: "cover",
                              borderRadius: 6,
                              marginBottom: 8,
                            }}
                            onError={(e) =>
                              (e.currentTarget.src = "/fallback.jpg")
                            }
                          />
                        )}

                        {/* Info */}
                        <div>
                          <b>{act.time}</b> — {act.title}
                        </div>
                        <div style={{ color: "#555", marginLeft: 10 }}>
                          📍 {act.location}
                        </div>
                        <div style={{ color: "#444", marginLeft: 10 }}>
                          {act.details}
                        </div>
                        <div style={{ color: "#15803d", marginLeft: 10 }}>
                          💰 {act.cost_estimate}
                        </div>
                        {act.link && (
                          <div style={{ marginLeft: 10 }}>
                            🔗{" "}
                            <a
                              href={act.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              More Info
                            </a>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
