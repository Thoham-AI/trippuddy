"use client";
import Chat from "@/components/Chat";
import TinderCard from 'react-tinder-card';
import React, { useState } from 'react';
import "../globals.css";

export default function ChatPage() {
  const [swipeStack, setSwipeStack] = useState([]);

  const handleNewDestinations = (data) => {
    setSwipeStack([...data].reverse()); 
  };

  return (
    <div className="min-h-screen bg-[#EFF3F8] flex flex-col items-center pt-10">
      <div className="relative w-[350px] h-[450px] mb-10">
        {swipeStack.map((city, index) => (
          <TinderCard className="absolute" key={`${city.name}-${index}`}>
            <div 
              style={{ backgroundImage: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.8)), url(${city.image})` }}
              className="w-[350px] h-[450px] bg-cover bg-center rounded-3xl p-6 flex flex-col justify-end text-white shadow-xl border-4 border-white"
            >
              <h3 className="text-2xl font-bold">{city.name}</h3>
              <p className="text-sm">{city.description}</p>
            </div>
          </TinderCard>
        ))}
      </div>
      <div className="w-full max-w-4xl px-4">
        <Chat onNewDestinations={handleNewDestinations} />
      </div>
    </div>
  );
}