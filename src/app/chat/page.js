"use client";
import React, { useState, useEffect, useRef } from "react";
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
  const childRefs = useRef([]);

  // 1. LOGIC CHỌN ĐỊA ĐIỂM KHÁC NHAU (POI)
  const handleSend = async (forcedText) => {
    const userMsg = forcedText || input.trim();
    if (!userMsg || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setInput("");

    try {
      const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
      
      // Danh sách địa điểm cụ thể để gợi ý (giúp tránh trùng ảnh)
      const poiList = {
        "hanoi": ["Hoan Kiem Lake", "Temple of Literature", "West Lake", "Hanoi Opera House", "St. Joseph's Cathedral"],
        "da nang": ["Golden Bridge", "Marble Mountains", "My Khe Beach", "Dragon Bridge", "Son Tra Peninsula"],
        "sydney": ["Opera House", "Bondi Beach", "Harbour Bridge", "The Rocks", "Darling Harbour"]
      };

      // Lấy danh sách 5 điểm, nếu không có trong list trên thì tạo từ khóa mặc định
      const locations = poiList[userMsg.toLowerCase()] || [
        `${userMsg} landmark`, `${userMsg} street`, `${userMsg} culture`, `${userMsg} food`, `${userMsg} nature`
      ];

      // Gọi API Unsplash cho từng địa điểm riêng biệt
      const cardPromises = locations.map(async (place) => {
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(place + " " + userMsg)}&client_id=${accessKey}&per_page=1`
        );
        const data = await res.json();
        return {
          name: place,
          image: data.results?.[0]?.urls?.regular || "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800"
        };
      });

      const newCards = await Promise.all(cardPromises);
      
      if (newCards.length > 0) {
        setDb(newCards.reverse()); // Đảo ngược để tấm đầu tiên nằm trên cùng
        setMessages((prev) => [...prev, { role: "ai", content: `I found 5 unique places in ${userMsg}. Swipe to explore!` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", content: "Sorry, I couldn't load the images." }]);
    } finally {
      setLoading(false);
    }
  };

  // 2. LOGIC NHẬN DIỆN GIỌNG NÓI
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Your browser does not support voice recognition.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; 
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };
    recognition.start();
  };

  // 3. LOGIC NÚT BẤM (GIỮ NGUYÊN)
  const swipe = (dir) => {
    if (db.length > 0) {
      const newDb = [...db];
      newDb.pop();
      setDb(newDb);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '10px', fontFamily: 'sans-serif' }}>
      
      {/* KHU VỰC THẺ BÀI */}
      <div style={{ position: 'relative', width: '340px', height: '420px', marginTop: '20px' }}>
        {db.map((city, index) => (
          <TinderCard 
            className="absolute" 
            key={city.image} 
            onSwipe={(dir) => swipe(dir)}
            preventSwipe={["up", "down"]}
          >
            <div style={{ 
              backgroundColor: 'white', width: '340px', height: '400px', borderRadius: '30px', 
              overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '4px solid white', position: 'relative' 
            }}>
              <img src={city.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={city.name} />
              <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', color: 'white', boxSizing: 'border-box' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>{city.name}</h2>
              </div>
            </div>
          </TinderCard>
        ))}
      </div>

      {/* CÁC NÚT ĐIỀU KHIỂN */}
      <div style={{ display: 'flex', gap: '30px', marginBottom: '20px' }}>
        <button 
          onClick={() => swipe('left')}
          style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#ef4444', fontSize: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', cursor: 'pointer' }}
        >
          <FaTimes />
        </button>
        <button 
          onClick={() => swipe('right')}
          style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#22c55e', fontSize: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', cursor: 'pointer' }}
        >
          <FaHeart />
        </button>
      </div>

      {/* LỊCH SỬ CHAT */}
      <div style={{ width: '100%', maxWidth: '450px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.role === 'user' ? '#2563eb' : 'white', color: m.role === 'user' ? 'white' : '#374151', padding: '12px 16px', borderRadius: '20px', maxWidth: '85%', fontSize: '14px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            {m.content}
          </div>
        ))}
      </div>

      {/* KHUNG NHẬP LIỆU */}
      <div style={{ width: '100%', maxWidth: '450px', backgroundColor: 'white', borderRadius: '25px', padding: '6px', display: 'flex', alignItems: 'center', boxShadow: '0 -5px 25px rgba(0,0,0,0.05)', marginBottom: '10px' }}>
        <button 
          onClick={startListening}
          style={{ border: 'none', backgroundColor: 'transparent', padding: '10px', color: isListening ? '#ef4444' : '#64748b', cursor: 'pointer', fontSize: '18px' }}
        >
          <FaMicrophone />
        </button>
        <input
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isListening ? "Listening..." : "Enter a city..."}
          style={{ flex: 1, padding: '10px', border: 'none', outline: 'none', fontSize: '16px' }}
        />
        <button 
          onClick={() => handleSend()} 
          disabled={loading}
          style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}