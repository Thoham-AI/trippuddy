"use client";
import React, { useState } from "react";
import TinderCard from "react-tinder-card";
import { FaHeart, FaTimes } from "react-icons/fa";

export default function ChatPage() {
  const [db, setDb] = useState([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hi Boss! Where do you want to explore today?" }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (forcedText) => {
    const userMsg = forcedText || input.trim();
    if (!userMsg || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setInput("");

    try {
      // Gọi qua Proxy để tránh lỗi CORS và Referer Restrictions
      const res = await fetch(`/api/google-proxy?input=${encodeURIComponent(userMsg)}`);
      const googleData = await res.json();
      
      if (googleData.results && googleData.results.length > 0) {
        // Sử dụng Key mới (không giới hạn domain) để hiển thị ảnh
        const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

        const cards = googleData.results.slice(0, 8).map((place) => ({
          id: place.place_id,
          name: place.name,
          image: place.photos 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${googleKey}`
            : "https://via.placeholder.com/400"
        }));

        // Đảo ngược mảng để kết quả đầu tiên hiện lên trên cùng của stack
        setDb(cards.reverse());
      } else {
        setMessages((prev) => [...prev, { role: "ai", content: "I couldn't find any places there. Try another spot?" }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "ai", content: "Connection error. Please try again!" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100dvh', 
      backgroundColor: '#f8fafc', 
      overflow: 'hidden' 
    }}>
      {/* 1. HEADER */}
      <header style={{ 
        backgroundColor: '#1e3a8a', 
        padding: '15px 0', 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '20px', 
        flexShrink: 0,
        zIndex: 10
      }}>
        {['Home', 'Build Trip', 'My Trips', 'Chat AI'].map(item => (
          <span key={item} style={{ color: '#fbbf24', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>{item}</span>
        ))}
      </header>

      {/* 2. VÙNG TRẢI NGHIỆM CHÍNH */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        paddingTop: '10px',
        position: 'relative',
        overflow: 'hidden' 
      }}>
        
        {/* VÙNG THÈ - Chồng 8 lớp thẻ lên nhau */}
        <div style={{ position: 'relative', width: '320px', height: '360px', flexShrink: 0 }}>
          {db.length > 0 ? (
            db.map((item, index) => (
              <div 
                key={item.id} 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  zIndex: index // Ép thẻ sau nằm dưới thẻ trước
                }}
              >
                <TinderCard 
                  onSwipe={() => {
                    // Xóa thẻ khỏi state sau khi quẹt để lộ thẻ bên dưới
                    setDb((prev) => prev.filter(v => v.id !== item.id));
                  }}
                  preventSwipe={["up", "down"]}
                >
                  <div style={{ 
                    backgroundColor: 'white', 
                    width: '320px', 
                    height: '340px', 
                    borderRadius: '25px', 
                    overflow: 'hidden', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                    position: 'relative',
                    border: '2px solid #eee'
                  }}>
                    <img 
                      src={item.image} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} 
                    />
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      width: '100%', 
                      padding: '20px 15px 60px', 
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', 
                      color: 'white' 
                    }}>
                      <h2 style={{ margin: 0, fontSize: '16px' }}>{item.name}</h2>
                    </div>
                    {/* Các nút bấm Like/Dislike */}
                    <div style={{ position: 'absolute', bottom: '15px', width: '100%', display: 'flex', justifyContent: 'center', gap: '40px' }}>
                       <button onClick={() => setDb((prev) => prev.filter(v => v.id !== item.id))} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes /></button>
                       <button onClick={() => setDb((prev) => prev.filter(v => v.id !== item.id))} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaHeart /></button>
                    </div>
                  </div>
                </TinderCard>
              </div>
            ))
          ) : (
            <div style={{ width: '300px', height: '320px', borderRadius: '25px', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', textAlign: 'center', padding: '20px' }}>
              No more cards! <br/> Ask for another city.
            </div>
          )}
        </div>

        {/* 3. VÙNG CHAT */}
        <div style={{ 
          width: '100%', 
          maxWidth: '600px', 
          backgroundColor: 'white',
          borderRadius: '30px 30px 0 0', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '15px',
          boxShadow: '0 -5px 20px rgba(0,0,0,0.05)',
          marginTop: '10px',
          overflow: 'hidden'
        }}>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px', 
            paddingBottom: '10px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{ 
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', 
                backgroundColor: m.role === 'user' ? '#2563eb' : '#f1f5f9', 
                color: m.role === 'user' ? 'white' : '#1e293b', 
                padding: '12px 18px', borderRadius: '20px', maxWidth: '85%', fontSize: '15px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
              }}>
                {m.content}
              </div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '13px' }}>TripPuddy is searching...</div>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '30px', padding: '6px 15px', border: '1px solid #e2e8f0' }}>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="Ask TripPuddy (e.g. Sydney, An Giang...)" 
              style={{ flex: 1, border: 'none', outline: 'none', background: 'none', padding: '10px', fontSize: '15px' }} 
            />
            <button onClick={() => handleSend()} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}