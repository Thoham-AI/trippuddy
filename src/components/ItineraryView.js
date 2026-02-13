'use client';

import React from "react";
import Image from 'next/image';

const fallbackImage = "/images/placeholder.jpg";

export type ItinerarySlot = {
  time: string;
  title: string;
  details?: string;
  cost_estimate?: string;
  image?: string;
  photo?: string;
  photo_url?: string;
  image_url?: string;
  link?: string;
  location?: {
    name: string;
    city?: string;
    country?: string;
  };
  coordinates?: {
    lat: number;
    lon: number;
  } | null;

  // ⭐ Weather fully typed
  weather?: {
    temp?: number;
    description?: string;
    icon?: string;
    link?: string;
  } | null;
};

export type ItineraryDay = {
  day: number;
  activities: ItinerarySlot[];
};

export default function ItineraryView({ itinerary }: { itinerary: ItineraryDay[] }) {
  if (!itinerary || itinerary.length === 0) {
    return (
      <div className="p-4 text-gray-600">
        No itinerary found. Please try generating again.
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4">
      {itinerary.map((day) => (
        <div key={day.day} className="border rounded-lg p-4 shadow">
          <h2 className="text-xl font-semibold mb-4">Day {day.day}</h2>

          <div className="space-y-4">
            {day.activities.map((slot, idx) => (
              <div key={idx} className="border p-3 rounded-lg bg-white shadow-sm">
                
                <div className="flex justify-between items-center">
                  {/* LEFT SIDE: Time + Title */}
                  <div>
                    <div className="font-semibold">{slot.time}</div>
                    <div className="text-lg font-bold">{slot.title}</div>
                  </div>

                  {/* ⭐ RIGHT SIDE: Image (fixed + zoomable) */}
                  {(slot.image || slot.photo || slot.photo_url || slot.image_url) && (
                    <img
                      src={
                        slot.image ||
                        slot.photo ||
                        slot.photo_url ||
                        slot.image_url ||
                        fallbackImage
                      }
                      alt={slot.title}
                      className="w-40 h-40 object-cover rounded-lg cursor-zoom-in hover:scale-105 transition-transform"
                      onClick={() =>
                        window.open(
                          slot.image ||
                            slot.photo ||
                            slot.photo_url ||
                            slot.image_url ||
                            fallbackImage,
                          "_blank"
                        )
                      }
                    />
                  )}
                </div>

                {/* Details / Description */}
                {slot.details && (
                  <p className="text-sm text-gray-700 mt-2">{slot.details}</p>
                )}

                {/* Location */}
                {slot.location && (
                  <p className="text-sm text-gray-600 mt-1">
                    📍 {slot.location.name}
                    {slot.location.city ? `, ${slot.location.city}` : ""}
                  </p>
                )}

                {/* Cost */}
                {slot.cost_estimate && (
                  <p className="text-sm text-gray-600 mt-1">
                    💰 {slot.cost_estimate}
                  </p>
                )}

                {/* ⭐ WEATHER (Step 3 fully implemented) */}
                {slot.weather && (
                  <div
                    onClick={() => slot.weather?.link && window.open(slot.weather.link, "_blank")}
                    className="flex items-center gap-2 cursor-pointer mt-2"
                  >
                    {slot.weather.icon && (
                      <img
                        src={`https://openweathermap.org/img/wn/${slot.weather.icon}@2x.png`}
                        className="w-6 h-6"
                        alt="weather icon"
                      />
                    )}

                    <span className="text-blue-600 underline">
                      {slot.weather.temp}°C — {slot.weather.description}
                    </span>
                  </div>
                )}

                {/* Optional external link */}
                {slot.link && (
                  <a
                    href={slot.link}
                    target="_blank"
                    className="text-blue-600 underline text-sm mt-2 inline-block"
                  >
                    View on map →
                  </a>
                )}

              </div>
            ))} {/* end activities map */}
          </div>
        </div>
      ))}
    </div>
  );
}
