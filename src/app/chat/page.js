"use client";
import Navbar from "@/components/Navbar";
import Chat from "@/components/Chat";
import TinderCard from 'react-tinder-card';
import React, { useState, useRef, useMemo } from 'react';
import "../globals.css";

export default function ChatPage() {
  const [swipeStack, setSwipeStack] = useState([]);
  const [likedPlaces, setLikedPlaces] = useState([]);
  const [dislikedPlaces, setDislikedPlaces] = useState([]);
  
  // Refs để điều khiển swipe bằng nút bấm
  const childRefs = useMemo(() => Array(20).fill(0).map(() => React.createRef()), []);

  const handleNewDestinations = (data) => {
    setLikedPlaces([]); 
    setDislikedPlaces([]);
    setSwipeStack([...data].reverse()); 
  };

  const onSwipe = (direction, city) => {
    if (direction === 'right') setLikedPlaces(prev => [...prev, city]);
    else setDislikedPlaces(prev => [...prev, city]);
    setSwipeStack(prev => prev.filter(item => item.name !== city.name));
  };

  const swipeByBtn = (dir) => {
    if (swipeStack.length > 0) {
      const index = swipeStack.length - 1; // Thẻ trên cùng
      childRefs[index].current.swipe(dir);
    }
  }

  return (
    <div className="min-h-screen bg-[#EFF3F8] flex flex-col">
      <Navbar />
      <div className="w-full flex flex-col items-center pb-20 mt-10">
        <div className="relative w-[350px] h-[450px] mb-10 flex items-center justify-center">
          
          {/* Hiển thị nút Make Itinerary khi hết thẻ */}
          {swipeStack.length === 0 && likedPlaces.length > 0 && (
            <div className="z-10 text-center">
               <button 
                onClick={() => window.createItinerary()}
                className="bg-[#0ea5a4] text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-[#0c8a88] transition-all"
              >
                📝 Make itinerary now
              </button>
            </div>
          )}

          {swipeStack.map((city, index) => (
            <TinderCard
              ref={childRefs[index]}
              className="absolute"
              key={`${city.name}-${index}`}
              onSwipe={(dir) => onSwipe(dir, city)}
              preventSwipe={['up', 'down']}
            >
              <div 
                style={{ backgroundImage: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.8)), url(${city.image})` }}
                className="w-[350px] h-[450px] bg-cover bg-center rounded-3xl p-6 flex flex-col justify-end text-white shadow-2xl border-4 border-white"
              >
                <h3 className="text-2xl font-bold">{city.name}</h3>
                <p className="text-sm opacity-90 mb-4">{city.description}</p>
                
                {/* 2 Nút bấm Chọn và Không chọn */}
                <div className="flex justify-between items-center gap-4">
                  <button 
                    onClick={() => swipeByBtn('left')}
                    className="flex-1 bg-red-500/90 py-2 rounded-xl text-xs font-bold hover:bg-red-600"
                  >
                    ✕ Không chọn
                  </button>
                  <button 
                    onClick={() => swipeByBtn('right')}
                    className="flex-1 bg-green-500/90 py-2 rounded-xl text-xs font-bold hover:bg-green-600"
                  >
                    ✓ Chọn
                  </button>
                </div>
              </div>
            </TinderCard>
          ))}
        </div>

        <div className="w-full max-w-4xl px-4">
          <Chat 
            onNewDestinations={handleNewDestinations} 
            likedPlaces={likedPlaces} 
            dislikedPlaces={dislikedPlaces}
          />
        </div>
      </div>
    </div>
  );
}