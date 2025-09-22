"use client";

import { useState } from "react";
import DestinationCard from "../components/DestinationCard";
import Itinerary from "../components/Itinerary";

export default function HomePage() {
  const [destinations, setDestinations] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDestinations(data.destinations || []);
      setItinerary(data.itinerary || []);
    } catch (err) {
      console.error(err);
      setDestinations([]);
      setItinerary([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div
        className="w-full h-96 bg-cover bg-center relative mb-10"
        style={{ backgroundImage: "url('/images/banner.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white">
            Explore Amazing Destinations
          </h1>
        </div>
      </div>

      {/* Prompt Box */}
      <div className="flex justify-center gap-4 mb-12 px-4">
        <input
          type="text"
          placeholder="e.g. 3 days in Vietnam with beaches"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 max-w-xl px-4 py-3 border rounded-lg"
        />
        <button
          onClick={generatePlan}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700"
        >
          {loading ? "Loading..." : "Generate"}
        </button>
      </div>

      {/* Destinations */}
      <div className="container mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 px-4">
        {destinations.map((dest) => (
          <DestinationCard key={dest.name} destination={dest} />
        ))}
      </div>

      {/* Itinerary */}
      <div className="container mx-auto px-4">
        <Itinerary itinerary={itinerary} />
      </div>
    </div>
  );
}
