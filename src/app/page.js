"use client";
import React, { useState, useEffect } from 'react';

export default function Home() {
  const affiliateId = "480743";
  const [randomDestinations, setRandomDestinations] = useState([]);
  const [heroImage, setHeroImage] = useState('');

  const pools = {
    vietnam: [
      { name: 'Phu Quoc', region: 'Vietnam' },
      { name: 'Da Nang', region: 'Vietnam' },
      { name: 'Hanoi', region: 'Vietnam' },
      { name: 'Ho Chi Minh City', region: 'Vietnam' }
    ],
    australia: [
      { name: 'Sydney', region: 'NSW, Australia' },
      { name: 'Melbourne', region: 'VIC, Australia' },
      { name: 'Gold Coast', region: 'QLD, Australia' }
    ],
    international: [
      { name: 'Tokyo', region: 'Japan' },
      { name: 'Paris', region: 'France' },
      { name: 'Bali', region: 'Indonesia' }
    ]
  };

  useEffect(() => {
    const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
    const initPage = async () => {
      try {
        const res = await fetch(`https://api.unsplash.com/photos/random?query=travel&client_id=${accessKey}&orientation=landscape`);
        const data = await res.json();
        setHeroImage(data.urls?.regular);
      } catch (e) { setHeroImage('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920'); }

      const pickRandom = (arr, count) => [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
      const selected = [...pickRandom(pools.vietnam, 2), ...pickRandom(pools.australia, 1), ...pickRandom(pools.international, 1)];

      const withImages = await Promise.all(selected.map(async (city) => {
        try {
          const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(city.name)}&client_id=${accessKey}&per_page=1`);
          const data = await res.json();
          return { ...city, image: data.results[0]?.urls?.small };
        } catch (e) { return { ...city, image: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800' }; }
      }));
      setRandomDestinations(withImages);
    };
    initPage();
  }, []);

  // STYLE NÚT SEND TỪ CHATBOT (COPY 1:1)
  const chatbotButtonStyle = {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'background-color 0.2s',
  };

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* NAVBAR */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 5%', alignItems: 'center', backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ fontSize: '24px', fontWeight: '900', color: '#2563eb' }}>TripPuddy</div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="/" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>Home</a>
          
          {/* Đã sửa đường dẫn theo ý Boss */}
          <a href="/itinerary" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>Build Trip</a>
          <a href="/my-trips" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>My Trips</a>
          <a href="/contact" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>Contact</a>
          <a href="/about" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>About</a>
          
          <a href="/chat" style={chatbotButtonStyle}>
            Chat AI ✨
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${heroImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', height: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '10px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Plan Your Adventure</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '30px' }}>AI-powered travel planning for you.</p>
        <a href="/chat" style={{ ...chatbotButtonStyle, padding: '16px 45px', fontSize: '18px' }}>
            Start Chatting with AI
        </a>
      </div>

      {/* DESTINATIONS (4 CỘT) */}
      <section style={{ padding: '60px 5%', maxWidth: '1400px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.2rem', marginBottom: '40px', textAlign: 'center', fontWeight: '900', color: '#1e293b' }}>Featured Destinations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {randomDestinations.map((city) => (
            <div key={city.name} style={{ backgroundColor: 'white', borderRadius: '30px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '4px solid white' }}>
              <div style={{ height: '160px' }}>
                <img src={city.image} alt={city.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: '20px' }}>
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '800', color: '#1e3a8a' }}>{city.name}</h3>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '15px' }}>{city.region}</p>
                <a href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city.name)}&aid=${affiliateId}`} 
                   target="_blank" rel="noopener noreferrer"
                   style={{ ...chatbotButtonStyle, display: 'block', textAlign: 'center' }}>
                  View Hotels
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '40px', textAlign: 'center', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
        <p>© 2026 TripPuddy. Developed by a Vietnamese-Australian Citizen. 🇦🇺 🇻🇳</p>
      </footer>
    </div>
  );
}