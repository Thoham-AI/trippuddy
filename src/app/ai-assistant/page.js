"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const affiliateId = "480743";
  const router = useRouter();
  const [randomDestinations, setRandomDestinations] = useState([]);
  const [heroImage, setHeroImage] = useState('');
  const [searchPrompt, setSearchPrompt] = useState('');

  // 1. CHỈNH SỬA HÀM ĐIỀU HƯỚNG
  const handleNavigation = (path) => {
    if (searchPrompt.trim()) {
      // Truyền câu hỏi của người dùng qua URL để trang đích có thể đọc được
      router.push(`${path}?q=${encodeURIComponent(searchPrompt)}`);
    } else {
      router.push(path);
    }
  };

  useEffect(() => {
    const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
    const initPage = async () => {
      try {
        const res = await fetch(`https://api.unsplash.com/photos/random?query=travel&client_id=${accessKey}&orientation=landscape`);
        const data = await res.json();
        setHeroImage(data.urls?.regular);
      } catch (e) { setHeroImage('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920'); }

      // Giả lập data điểm đến (Bạn có thể giữ nguyên phần fetch Unsplash cũ của bạn)
      const mockCities = [
        { name: 'Sydney', region: 'NSW, Australia', image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=500' },
        { name: 'Ho Chi Minh City', region: 'Vietnam', image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=500' }
      ];
      setRandomDestinations(mockCities);
    };
    initPage();
  }, []);

  const chatbotButtonStyle = {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '15px',
    textDecoration: 'none',
    display: 'inline-block',
  };

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* NAVBAR */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 5%', alignItems: 'center', backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '26px', fontWeight: '900', color: '#2563eb' }}>TripPuddy</div>
        <div style={{ display: 'flex', gap: '25px' }}>
          <a href="/" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>Home</a>
          <a href="/my-trips" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>My Trips</a>
          {/* Nút vào thẳng trang AI Assistant trên Navbar */}
          <button onClick={() => router.push('/ai-assistant')} style={{ ...chatbotButtonStyle, padding: '8px 15px' }}>AI Assistant ✨</button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div style={{ 
        backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url('${heroImage}')`, 
        backgroundSize: 'cover', backgroundPosition: 'center', height: '80vh', 
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white'
      }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '20px' }}>Plan Your Adventure</h1>
        
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <div style={{ backgroundColor: 'white', padding: '5px', borderRadius: '50px', display: 'flex', marginBottom: '20px' }}>
            <input 
              type="text" 
              placeholder="Bạn muốn đi đâu? (VD: 3 ngày ở Đà Lạt)" 
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigation('/ai-assistant')}
              style={{ flex: 1, border: 'none', padding: '15px 25px', fontSize: '16px', outline: 'none', color: '#333', borderRadius: '50px' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            {/* 2. SỬA LINK Ở ĐÂY: Dẫn tới /ai-assistant thay vì /chat */}
            <button onClick={() => handleNavigation('/ai-assistant')} style={{ ...chatbotButtonStyle, backgroundColor: '#059669' }}>
              Chat with AI Assistant 💬
            </button>
          </div>
        </div>
      </div>

      {/* 3. BONG BÓNG CHAT NỔI (FLOATING BUBBLE) */}
      <button 
        onClick={() => router.push('/ai-assistant')}
        style={{
          position: 'fixed', bottom: '30px', right: '30px', width: '60px', height: '60px',
          backgroundColor: '#f59e0b', borderRadius: '50%', border: 'none', cursor: 'pointer',
          boxShadow: '0 10px 20px rgba(0,0,0,0.2)', fontSize: '24px', zIndex: 1000
        }}
      >
        🤖
      </button>

      <footer style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
        <p>© 2026 TripPuddy. Tự hào phục vụ công dân 🇦🇺 & 🇻🇳.</p>
      </footer>
    </div>
  );
}