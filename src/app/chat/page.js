"use client";
import React, { useState } from "react";
import TinderCard from "react-tinder-card";
import { FaHeart, FaTimes, FaMicrophone } from "react-icons/fa";

export default function ChatPage() {
  const [db, setDb] = useState([
    { name: "Welcome to TripPuddy!", image: "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800" }
  ]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Thư viện tọa độ ngầm để vây vùng tìm kiếm chính xác
  const provinceCoords = {
    "thái bình": { lat: 20.4463, lng: 106.3364 },
    "hà giang": { lat: 22.8233, lng: 104.9835 },
    "ninh bình": { lat: 20.2506, lng: 105.9745 },
    "hà nội": { lat: 21.0285, lng: 105.8542 }
  };

// ... (Giữ nguyên các phần state bên trên)

const handleSend = async (forcedText) => {
  const userMsg = forcedText || input.trim();
  if (!userMsg || loading) return;

  setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
  setLoading(true);
  setInput("");

  try {
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    // Tăng cường query để Google trả về nhiều kết quả hơn
    const refinedQuery = `best tourist attractions landmarks scenery in ${userMsg} Vietnam`;
    
    const res = await fetch(`/api/google-proxy?input=${encodeURIComponent(refinedQuery)}`);
    const googleData = await res.json();

    if (googleData.results && googleData.results.length > 0) {
      const filteredCards = googleData.results
        .filter(place => place.photos && place.user_ratings_total > 30) // Giảm nhẹ lọc để có nhiều ảnh hơn
        .map((place) => ({
          name: place.name,
          image: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1000&photoreference=${place.photos[0].photo_reference}&key=${googleKey}`
        }));

      if (filteredCards.length > 0) {
        // Tăng số lượng hiển thị lên (Google Text Search thường trả về tối đa 20 kết quả/trang)
        setDb(filteredCards.reverse()); 
        setMessages((prev) => [...prev, { role: "ai", content: `I found ${filteredCards.length} spots! Swipe to explore.` }]);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};

// Sửa lại hàm swipe để đảm bảo đồng bộ với thư viện
const onSwipe = (direction, nameToDelete) => {
  console.log('You swiped: ' + direction);
  setDb((prev) => prev.filter(item => item.name !== nameToDelete));
};

// ... trong phần return JSX:

<div style={{ position: 'relative', width: '340px', height: '400px', marginTop: '20px', flexShrink: 0 }}>
  {db.map((item, index) => (
    <TinderCard 
      key={item.name + index} 
      onSwipe={(dir) => onSwipe(dir, item.name)} // Gọi hàm xóa khi quẹt xong
      preventSwipe={["up", "down"]}
      swipeThreshold={100} // CỰC KỲ QUAN TRỌNG: Độ dài (pixel) cần kéo để xác nhận là Swipe
      flickOnSwipe={true}   // Giúp ảnh bay vèo đi khi nhả chuột mạnh
      style={{ position: 'absolute' }}
    >
      <div style={{ 
        backgroundColor: 'white', width: '340px', height: '380px', borderRadius: '30px', 
        overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '4px solid white', 
        position: 'relative', cursor: 'grab' // Đổi con trỏ chuột cho giống app thật
      }}>
        <img 
          src={item.image} 
          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} 
          alt={item.name} 
        />
        <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', color: 'white', boxSizing: 'border-box' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{item.name}</h2>
        </div>
      </div>
    </TinderCard>
  ))}
</div>

  const swipe = () => {
    setDb((prev) => {
      const newDb = [...prev];
      newDb.pop();
      return newDb;
    });
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onresult = (e) => handleSend(e.results[0][0].transcript);
    recognition.start();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
      
      {/* TINDER CARDS */}
      <div style={{ position: 'relative', width: '340px', height: '400px', marginTop: '20px', flexShrink: 0 }}>
        {db.map((item, index) => (
          <div key={item.name + index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <TinderCard onSwipe={swipe} preventSwipe={["up", "down"]}>
              <div style={{ 
                backgroundColor: 'white', width: '340px', height: '380px', borderRadius: '30px', 
                overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '4px solid white', position: 'relative' 
              }}>
                <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} alt="Destinations" />
                <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', color: 'white', boxSizing: 'border-box' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{item.name}</h2>
                </div>
              </div>
            </TinderCard>
          </div>
        ))}
      </div>

      {/* CONTROLS */}
      <div style={{ display: 'flex', gap: '40px', margin: '15px 0', zIndex: 10 }}>
        <button onClick={swipe} style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#ef4444', fontSize: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', cursor: 'pointer' }}><FaTimes /></button>
        <button onClick={swipe} style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#22c55e', fontSize: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', cursor: 'pointer' }}><FaHeart /></button>
      </div>

      {/* MESSAGES */}
      <div style={{ width: '100%', maxWidth: '450px', flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 15px 10px 15px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.role === 'user' ? '#2563eb' : 'white', color: m.role === 'user' ? 'white' : '#333', padding: '10px 16px', borderRadius: '20px', maxWidth: '85%', fontSize: '14px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            {m.content}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div style={{ width: '90%', maxWidth: '400px', backgroundColor: 'white', borderRadius: '30px', padding: '5px 15px', display: 'flex', alignItems: 'center', boxShadow: '0 -5px 20px rgba(0,0,0,0.05)', marginBottom: '15px', flexShrink: 0 }}>
        <button onClick={startListening} style={{ border: 'none', background: 'none', color: '#64748b', padding: '10px' }}><FaMicrophone /></button>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Where do we go?" style={{ flex: 1, border: 'none', outline: 'none', padding: '10px', fontSize: '15px' }} />
        <button onClick={() => handleSend()} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: 'bold' }}>Send</button>
      </div>
    </div>
  );
}