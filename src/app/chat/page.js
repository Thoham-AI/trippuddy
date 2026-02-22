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
      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
      
      // SỬA CHỖ NÀY: Gọi trực tiếp Google API bằng Key đã được Boss whitelist domain trippuddy.com
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(userMsg)}&key=${googleKey}`);
      const googleData = await res.json();
      
      if (googleData.results) {
        const cards = googleData.results.slice(0, 8).map((place) => ({
          id: place.place_id,
          name: place.name,
          image: place.photos 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${googleKey}`
            : "https://via.placeholder.com/400"
        }));
        setDb(cards.reverse());
      }
    } catch (e) {
      console.error("Lỗi gọi API:", e);
      setMessages((prev) => [...prev, { role: "ai", content: "Sorry Boss, something went wrong with the connection." }]);
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
        
        {/* VÙNG THẺ */}
        <div style={{ position: 'relative', width: '320px', height: '360px', flexShrink: 0, touchAction: 'none' }}>
          {db.length > 0 ? (
            db.map((item) => (
              <div key={item.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 50 }}>
                <TinderCard 
                  onSwipe={() => setDb((prev) => prev.filter(v => v.id !== item.id))}
                  onCardLeftScreen={() => setDb((prev) => prev.filter(v => v.id !== item.id))}
                  preventSwipe={["up", "down"]}
                  swipeThreshold={30} 
                  flickOnSwipe={true}
                >
                  <div style={{ 
                    backgroundColor: 'white', width: '320px', height: '340px', borderRadius: '25px', 
                    overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '3px solid white', 
                    position: 'relative', cursor: 'grab'
                  }}>
                    <img 
                      src={item.image} 
                      onDragStart={(e) => e.preventDefault()}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }} 
                    />
                    <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '20px 15px 60px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', color: 'white', pointerEvents: 'none' }}>
                      <h2 style={{ margin: 0, fontSize: '16px' }}>{item.name}</h2>
                    </div>
                    <div style={{ position: 'absolute', bottom: '15px', width: '100%', display: 'flex', justifyContent: 'center', gap: '40px', zIndex: 100 }}>
                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setDb((prev) => prev.filter(v => v.id !== item.id)); }} style={{ width: '45px', height: '45px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#ef4444', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', cursor: 'pointer' }}><FaTimes /></button>
                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setDb((prev) => prev.filter(v => v.id !== item.id)); }} style={{ width: '45px', height: '45px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#22c55e', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', cursor: 'pointer' }}><FaHeart /></button>
                    </div>
                  </div>
                </TinderCard>
              </div>
            ))
          ) : (
            <div style={{ width: '300px', height: '320px', borderRadius: '25px', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', textAlign: 'center', padding: '10px' }}>
              Ready for a new trip?<br/>Type a location below!
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '30px', padding: '6px 15px', border: '1px solid #e2e8f0' }}>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="Ask TripPuddy..." 
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