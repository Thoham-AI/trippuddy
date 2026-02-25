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
  const [likedPlaces, setLikedPlaces] = useState([]);

  // Hàm gửi tin nhắn/tìm địa điểm
  const handleSend = async (forcedText) => {
    const userMsg = forcedText || input.trim();
    if (!userMsg || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setInput("");

    try {
      const res = await fetch(`/api/google-proxy?input=${encodeURIComponent(userMsg)}`);
      const googleData = await res.json();
      
      if (googleData.results && googleData.results.length > 0) {
        const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
        const cards = await Promise.all(googleData.results.slice(0, 8).map(async (place) => {
          let finalDescription = place.description;
          if (!finalDescription || finalDescription === "A great place to explore!") {
            try {
              const aiRes = await fetch("/api/ai-tip", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ placeName: place.name, location: userMsg, types: place.types || [] })
              });
              if (aiRes.ok) {
                const aiData = await aiRes.json();
                finalDescription = aiData.tip;
              }
            } catch (e) {
              finalDescription = `Boss, ${place.name} is a fantastic spot in ${userMsg}!`;
            }
          }
          return {
            id: place.place_id,
            name: place.name,
            rating: place.rating,
            description: finalDescription,
            image: place.photos 
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${googleKey}`
              : "https://via.placeholder.com/400"
          };
        }));
        setDb(cards.reverse());
        setMessages((prev) => [...prev, { role: "ai", content: `Here're a few places in ${userMsg}, which one do you want to visit?` }]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", content: "I couldn't find anything there. Try another city?" }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", content: "Connection error!" }]);
    } finally { setLoading(false); }
  };

  // Logic tạo Itinerary từ các địa điểm đã Like
// Logic tạo Itinerary từ các địa điểm đã Like
  const makeItinerary = () => {
    if (likedPlaces.length === 0) return;
    
    // Lưu danh sách tên các địa điểm vào localStorage để trang Itinerary có thể đọc được
    const placeNames = likedPlaces.map(p => p.name).join(", ");
    localStorage.setItem("selectedPlacesForItinerary", placeNames);
    
    // Thông báo cho Boss và chuyển hướng
    setMessages(prev => [...prev, { role: "ai", content: `Got it Boss! Redirecting you to Build Trip to plan for: ${placeNames}...` }]);
    
    setTimeout(() => {
      window.location.href = "/itinerary"; // Dẫn Boss sang folder itinerary
    }, 1500);
  };

  const onSwipe = (direction, item) => {
    if (direction === 'right') setLikedPlaces((prev) => [...prev, item]);
    setDb((prev) => prev.filter(v => v.id !== item.id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
      <header style={{ backgroundColor: '#1e3a8a', padding: '15px 0', display: 'flex', justifyContent: 'center', gap: '20px', flexShrink: 0, zIndex: 10 }}>
        {['Home', 'Build Trip', 'My Trips', 'Chat AI'].map(item => (
          <span key={item} style={{ color: '#fbbf24', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>{item}</span>
        ))}
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', width: '320px', height: '360px', flexShrink: 0 }}>
          {db.length > 0 ? (
            db.map((item, index) => (
              <div key={item.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: index }}>
                <TinderCard onSwipe={(dir) => onSwipe(dir, item)} preventSwipe={["up", "down"]}>
                  <div style={{ backgroundColor: 'white', width: '320px', height: '340px', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', position: 'relative', border: '2px solid #eee' }}>
                    <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '20px 15px 60px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', color: 'white' }}>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{item.name}</h2>
                      <p style={{ margin: '8px 0 0', fontSize: '12px', lineHeight: '1.4', color: '#e2e8f0', fontStyle: 'italic' }}>"{item.description}"</p>
                    </div>
                    <div style={{ position: 'absolute', bottom: '15px', width: '100%', display: 'flex', justifyContent: 'center', gap: '40px' }}>
                       <button onClick={() => onSwipe('left', item)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#ef4444' }}><FaTimes /></button>
                       <button onClick={() => onSwipe('right', item)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#22c55e' }}><FaHeart /></button>
                    </div>
                  </div>
                </TinderCard>
              </div>
            ))
          ) : (
            <div style={{ width: '300px', height: '320px', borderRadius: '25px', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', textAlign: 'center', padding: '20px' }}>
              {likedPlaces.length > 0 ? "Ready to build your trip?" : "Ask for a city to start!"}
            </div>
          )}
        </div>

        <div style={{ width: '100%', maxWidth: '600px', backgroundColor: 'white', borderRadius: '30px 30px 0 0', flex: 1, display: 'flex', flexDirection: 'column', padding: '15px', boxShadow: '0 -5px 20px rgba(0,0,0,0.05)', marginTop: '10px', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '10px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.role === 'user' ? '#2563eb' : '#f1f5f9', color: m.role === 'user' ? 'white' : '#1e293b', padding: '12px 18px', borderRadius: '20px', maxWidth: '85%', fontSize: '15px' }}>
                {m.content}
              </div>
            ))}
            
            {/* KẾT NỐI NÚT VÀO LOGIC TẠO LỊCH TRÌNH */}
            {likedPlaces.length > 0 && db.length === 0 && !loading && (
              <div style={{ alignSelf: 'center', marginTop: '10px' }}>
                <button 
                  onClick={makeItinerary}
                  style={{ backgroundColor: '#fbbf24', color: '#1e3a8a', border: 'none', padding: '12px 25px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  Make your own itinerary ({likedPlaces.length})
                </button>
              </div>
            )}
            {loading && <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '13px' }}>Processing...</div>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '30px', padding: '6px 15px', border: '1px solid #e2e8f0' }}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask TripPuddy..." style={{ flex: 1, border: 'none', outline: 'none', background: 'none', padding: '10px' }} />
            <button onClick={() => handleSend()} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold' }}>Send</button>
          </div>
        </div>
      </main>
    </div>
  );
}