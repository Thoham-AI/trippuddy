"use client";
import Navbar from "@/components/Navbar";
import Chat from "@/components/Chat";
import TinderCard from 'react-tinder-card';
import React, { useState } from 'react';
import "../globals.css";

export default function ChatPage() {
  const [swipeStack, setSwipeStack] = useState([]);
  const [likedPlaces, setLikedPlaces] = useState([]); // Lưu các chỗ bạn quẹt phải

  const handleNewDestinations = (data) => {
    setLikedPlaces([]); // Reset danh sách thích khi có gợi ý mới
    setSwipeStack([...data].reverse()); 
  };

  const onSwipe = (direction, city) => {
    console.log('Bạn đã quẹt: ' + direction + ' cho ' + city.name);
    
    // Nếu quẹt phải (right), thêm vào danh sách yêu thích
    if (direction === 'right') {
      setLikedPlaces(prev => [...prev, city]);
    }

    // Xóa thẻ vừa quẹt khỏi stack
    setSwipeStack(prev => prev.filter(item => item.name !== city.name));
  };

  return (
    <div className="min-h-screen bg-[#EFF3F8] flex flex-col">
      <Navbar />
      <div className="w-full flex flex-col items-center pb-20 mt-10">
        
        {/* KHU VỰC THẺ TINDER */}
        <div className="relative w-[350px] h-[450px] mb-10 flex items-center justify-center">
          
          {/* Hiển thị khi hết thẻ */}
          {swipeStack.length === 0 && (
            <div className="text-center p-6 bg-white rounded-3xl shadow-md border-2 border-dashed border-gray-300 w-[320px]">
              {likedPlaces.length > 0 ? (
                <div>
                  <h3 className="text-lg font-bold text-[#0ea5a4] mb-2">Tuyệt vời! 😍</h3>
                  <p className="text-sm text-gray-600 mb-4">Bạn đã chọn được {likedPlaces.length} địa điểm yêu thích.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {likedPlaces.map((p, i) => (
                      <span key={i} className="bg-[#0ea5a4] text-white px-3 py-1 rounded-full text-xs">{p.name}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">Hãy hỏi TripPuddy để nhận gợi ý du lịch mới nhé! ✈️</p>
              )}
            </div>
          )}

          {/* Danh sách thẻ để quẹt */}
          {swipeStack.map((city, index) => (
            <TinderCard
              className="absolute"
              key={`${city.name}-${index}`}
              onSwipe={(dir) => onSwipe(dir, city)}
              preventSwipe={['up', 'down']}
            >
              <div 
                style={{ backgroundImage: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.8)), url(${city.image})` }}
                className="w-[350px] h-[450px] bg-cover bg-center rounded-3xl p-6 flex flex-col justify-end text-white shadow-2xl border-4 border-white cursor-grab active:cursor-grabbing"
              >
                <h3 className="text-2xl font-bold">{city.name}</h3>
                <p className="text-sm opacity-90">{city.description}</p>
                <div className="flex justify-between mt-4 text-xs font-bold uppercase tracking-widest">
                  <span className="text-red-400">← Bỏ qua</span>
                  <span className="text-green-400">Thích →</span>
                </div>
              </div>
            </TinderCard>
          ))}
        </div>

        {/* KHU VỰC CHAT */}
        <div className="w-full max-w-4xl px-4">
          <Chat onNewDestinations={handleNewDestinations} />
        </div>
      </div>
    </div>
  );
}