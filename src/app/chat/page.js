"use client";
import React, { useState } from "react";
import TinderCard from "react-tinder-card";
import { FaHeart, FaTimes } from "react-icons/fa";
import Navbar from "@/components/Navbar";

export default function ChatPage() {
  const [db, setDb] = useState([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hi Boss! Where do you want to explore today?" }
  ]);
  const [loading, setLoading] = useState(false);
  const [likedPlaces, setLikedPlaces] = useState([]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setInput("");

    try {
      // Logic: MongoDB -> Unsplash -> Google Places (Handled in your API route)
      const res = await fetch(`/api/google-proxy?input=${encodeURIComponent(userMsg)}`);
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        setDb(data.results.reverse());
        setMessages((prev) => [...prev, { role: "ai", content: `Found some spots in ${userMsg}!` }]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", content: "No places found. Try another city?" }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", content: "Connection error!" }]);
    } finally { 
      setLoading(false); 
    }
  };

  const onSwipe = (direction, item) => {
    if (direction === 'right') setLikedPlaces((prev) => [...prev, item]);
    // Use the same unique ID logic to filter out the card
    setDb((prev) => prev.filter(v => v.place_id !== item.place_id));
  };

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100dvh', 
      backgroundColor: '#ecfeff', // Even lighter Cyan (Cyan 50)
      overflow: 'hidden' 
    }}>
      <Navbar />

      <main style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', position: 'relative', pointerEvents: 'none' 
      }}>
        <div style={{ position: 'relative', width: '340px', height: '500px', pointerEvents: 'auto' }}>
          {db.length > 0 ? (
            db.map((item, index) => (
              /* FIX: Added index to key to ensure uniqueness */
              <TinderCard 
                key={`${item.place_id}-${index}`} 
                onSwipe={(dir) => onSwipe(dir, item)} 
                preventSwipe={["up", "down"]}
              >
                <div style={{ 
                  backgroundColor: 'white', height: '480px', borderRadius: '30px', 
                  overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', position: 'relative' 
                }}>
                  <img 
                    src={item.image} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    alt={item.name} 
                    /* Fallback to Unsplash if image fails to load */
                    onError={(e) => { e.target.src = `https://source.unsplash.com/800x1000/?${encodeURIComponent(item.name)}`; }}
                  />
                  
                  <div style={{ 
                    position: 'absolute', inset: 0, 
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', 
                    padding: '20px 20px 100px' 
                  }}>
                    <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 'bold' }}>{item.name}</h2>
                    <p style={{ color: '#cbd5e1', fontSize: '13px' }}>{item.address}</p>
                  </div>

                  <div style={{ 
                    position: 'absolute', bottom: '30px', left: '0', right: '0', 
                    display: 'flex', justifyContent: 'center', gap: '40px', zIndex: 50 
                  }}>
                    <button onClick={(e) => { e.stopPropagation(); onSwipe('left', item); }} style={circleBtnStyle("#fee2e2", "#ef4444")}><FaTimes /></button>
                    <button onClick={(e) => { e.stopPropagation(); onSwipe('right', item); }} style={circleBtnStyle("#d1fae5", "#10b981")}><FaHeart /></button>
                  </div>
                </div>
              </TinderCard>
            ))
          ) : (
            <div style={{ 
              color: '#164e63', textAlign: 'center', padding: '30px', 
              background: 'rgba(255,255,255,0.4)', borderRadius: '30px', backdropFilter: 'blur(10px)' 
            }}>
               <p style={{ fontWeight: 'bold' }}>{likedPlaces.length > 0 ? `Selected ${likedPlaces.length} places!` : "Enter a city to explore!"}</p>
            </div>
          )}
        </div>
      </main>

      {/* Input Bar */}
      <div style={{ 
        position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', 
        zIndex: 100, width: 'min(500px, 92%)', pointerEvents: 'auto' 
      }}>
        <div style={{ 
          display: 'flex', background: 'white', borderRadius: '30px', padding: '8px 15px', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #cffafe' 
        }}>
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            placeholder="Search city..." 
            style={{ flex: 1, border: 'none', outline: 'none', padding: '10px' }} 
          />
          <button onClick={() => handleSend()} style={{ background: "#06b6d4", color: "white", border: "none", padding: "10px 25px", borderRadius: "20px", fontWeight: "bold" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const circleBtnStyle = (bg, color) => ({
  width: "60px", height: "60px", borderRadius: "50%", backgroundColor: bg, color: color,
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px",
  border: "none", cursor: "pointer", boxShadow: "0 6px 12px rgba(0,0,0,0.1)", pointerEvents: "auto"
});