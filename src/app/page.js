"use client";
import React, { useState, useEffect } from 'react';

/**
 * HomePage Component
 * Path: C:\Users\Anyone\travel-ai-app\src\app\page.js
 */
export default function Home() {
  const affiliateId = "480743";
  const [randomDestinations, setRandomDestinations] = useState([]);
  const [heroImage, setHeroImage] = useState('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1950&q=80');

  // Background pool for the Hero section
  const heroPool = [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80', // Adventure/Road Trip
    'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=1920&q=80', // Sydney Opera House
    'https://images.unsplash.com/photo-1528127269322-539801943592?w=1920&q=80', // Ha Long Bay, Vietnam
    'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1920&q=80', // Sydney Harbour Bridge
    'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1920&q=80'  // Hanoi Old Quarter
  ];

  const pools = {
    vietnam: [
      { name: 'Phu Quoc', region: 'Vietnam', image: 'https://images.unsplash.com/photo-1589782104152-17367f8b5ec8?w=600&q=80' },
      { name: 'Da Nang', region: 'Vietnam', image: 'https://images.unsplash.com/photo-1559592413-7ece350ac161?w=600&q=80' },
      { name: 'Hanoi', region: 'Vietnam', image: 'https://images.unsplash.com/photo-1555921015-5532091f6026?w=600&q=80' },
      { name: 'Ho Chi Minh City', region: 'Vietnam', image: 'https://images.unsplash.com/photo-1509030464150-144d4267e681?w=600&q=80' },
      { name: 'Ha Long Bay', region: 'Vietnam', image: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=600&q=80' }
    ],
    australia: [
      { name: 'Sydney', region: 'NSW, Australia', image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=600&q=80' },
      { name: 'Melbourne', region: 'VIC, Australia', image: 'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=600&q=80' },
      { name: 'Cairns', region: 'QLD, Australia', image: 'https://images.unsplash.com/photo-1551065160-2646960858fb?w=600&q=80' },
      { name: 'Gold Coast', region: 'QLD, Australia', image: 'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=600&q=80' },
      { name: 'Perth', region: 'WA, Australia', image: 'https://images.unsplash.com/photo-1534008757030-2670ca430399?w=600&q=80' }
    ],
    international: [
      { name: 'Tokyo', region: 'Japan', image: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&q=80' },
      { name: 'Paris', region: 'France', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80' },
      { name: 'London', region: 'UK', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80' },
      { name: 'Bali', region: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80' },
      { name: 'New York', region: 'USA', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80' }
    ]
  };

  useEffect(() => {
    // 1. Randomize Hero Background
    const randomHero = heroPool[Math.floor(Math.random() * heroPool.length)];
    setHeroImage(randomHero);

    // 2. Randomize Destinations (2 VN, 1 AU, 1 INT)
    const pickRandom = (arr, count) => [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
    const selected = [
      ...pickRandom(pools.vietnam, 2),
      ...pickRandom(pools.australia, 1),
      ...pickRandom(pools.international, 1)
    ];
    setRandomDestinations(selected.sort(() => 0.5 - Math.random()));
  }, []);

  return (
    <div>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo text-3xl font-bold">TripPuddy</div>
        <div className="navbar-links">
          <a href="/">Home</a>
          <a href="/chat" className="chat-btn">Chat AI</a>
        </div>
        <a href="/login" className="nav-login-btn">Login</a>
      </div>

      {/* HERO SECTION with Randomized Background */}
      <div className="hero" style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${heroImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        textAlign: 'center', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh', 
        color: 'white',
        transition: 'background-image 0.5s ease-in-out'
      }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '20px', textShadow: '2px 2px 10px rgba(0,0,0,0.7)', fontWeight: '800' }}>
          Plan Your Next Adventure
        </h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '40px', textShadow: '1px 1px 5px rgba(0,0,0,0.5)' }}>
          AI-powered travel planning for local and international trips.
        </p>
        <a href="/chat">
          <button style={{ 
            padding: '18px 45px', 
            backgroundColor: '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '35px', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
          }}>
            ✨ Start Planning with AI
          </button>
        </a>
      </div>

      {/* SUGGESTIONS SECTION */}
      <section style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '40px', textAlign: 'center' }}>
          Featured Destinations
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
          {randomDestinations.map((city) => (
            <div key={city.name} style={{ borderRadius: '20px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <div style={{ height: '200px', width: '100%', overflow: 'hidden' }}>
                <img 
                  src={city.image} 
                  alt={city.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: '25px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', color: '#1e3a8a', fontWeight: '700' }}>{city.name}</h3>
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '20px' }}>{city.region}</p>
                <a 
                  href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city.name)}&aid=${affiliateId}&lang=en-gb`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', backgroundColor: '#003580', color: 'white', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700', textDecoration: 'none', textAlign: 'center' }}
                >
                  View Hotel Deals
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '60px 20px', textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>
          © 2026 TripPuddy. Developed by a Vietnamese-Australian Citizen. 🇦🇺 🇻🇳
        </p>
      </footer>
    </div>
  );
}