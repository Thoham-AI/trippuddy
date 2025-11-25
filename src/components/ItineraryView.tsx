'use client';

import React from "react";
import Image from 'next/image'; // Imported as 'Image'

export type ItinerarySlot = {
  time: string;
  title: string;
  details?: string;
  cost_estimate?: string;
  image?: string;
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
  weather?: {
    temp?: number;
    description?: string;
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
                  <div>
                    <div className="font-semibold">{slot.time}</div>
                    <div className="text-lg font-bold">{slot.title}</div>
                  </div>

                  {slot.image && (
                    <Image // FIX 1: Changed <Img> to <Image>
                      src={slot.image}
                      alt={slot.title}
                      width={96} // FIX 2: ADDED mandatory width
                      height={96} // FIX 2: ADDED mandatory height
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                </div>

                {slot.details && (
                  <p className="text-sm text-gray-700 mt-2">{slot.details}</p>
                )}

                {slot.location && (
                  <p className="text-sm text-gray-600 mt-1">
                    📍 {slot.location.name}
                    {slot.location.city ? `, ${slot.location.city}` : ""}
                  </p>
                )}

                {slot.cost_estimate && (
                  <p className="text-sm text-gray-600 mt-1">
                    💰 {slot.cost_estimate}
                  </p>
                )}

                {slot.weather && (
                  <p className="text-sm text-gray-600 mt-1">
                    🌤 {slot.weather.temp}°C, {slot.weather.description}
                  </p>
                )}

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
            ))} {/* ← fully correct closing of map() AND JSX */}
          </div>
        </div>
      ))}
    </div>
  );
}