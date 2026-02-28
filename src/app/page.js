"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const affiliateId = "480743";
  const router = useRouter();
  const [randomDestinations, setRandomDestinations] = useState([]);
  const [heroImage, setHeroImage] = useState('');
  const [searchPrompt, setSearchPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const pools = {
    vietnam: [
      { name: 'Phu Quoc', region: 'Vietnam', guide: 'https://vietnam.travel/destinations/phu-quoc', temp: '30°C', icon: '☀️' },
      { name: 'Da Nang', region: 'Vietnam', guide: 'https://vietnam.travel/destinations/da-nang', temp: '28°C', icon: '⛅' },
      { name: 'Hanoi', region: 'Vietnam', guide: 'https://vietnam.travel/destinations/ha-noi', temp: '22°C', icon: '☁️' },
      { name: 'Ho Chi Minh City', region: 'Vietnam', guide: 'https://vietnam.travel/destinations/ho-chi-minh-city', temp: '32°C', icon: '☀️' }
    ],
    australia: [
      { name: 'Sydney', region: 'NSW, Australia', guide: 'https://www.australia.com/en/places/sydney-and-surrounds/guide-to-sydney.html', temp: '24°C', icon: '☀️' },
      { name: 'Melbourne', region: 'VIC, Australia', guide: 'https://www.australia.com/en/places/melbourne-and-surrounds/guide-to-melbourne.html', temp: '19°C', icon: '🌦️' },
      { name: 'Gold Coast', region: 'QLD, Australia', guide: 'https://www.australia.com/en/places/gold-coast-and-surrounds/guide-to-the-gold-coast.html', temp: '26°C', icon: '☀️' }
    ],
    international: [
      { name: 'Tokyo', region: 'Japan', guide: 'https://www.gotokyo.org/en/', temp: '12°C', icon: '❄️' },
      { name: 'Paris', region: 'France', guide: 'https://www.parisinfo.com/', temp: '15°C', icon: '🌧️' },
      { name: 'Bali', region: 'Indonesia', guide: 'https://www.indonesia.travel/', temp: '29°C', icon: '⛅' }
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
          return { ...city, image: data.results[0]?.urls?.regular };
        } catch (e) { return { ...city, image: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800' }; }
      }));
      setRandomDestinations(withImages);
    };
    initPage();
  }, []);

  const handleSearch = (targetPath) => {
    if (searchPrompt.trim()) {
      router.push(`${targetPath}?q=${encodeURIComponent(searchPrompt)}`);
    } else {
      router.push(targetPath);
    }
  };

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
    transition: 'all 0.3s ease',
  };

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 5%', alignItems: 'center', backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ fontSize: '26px', fontWeight: '900', color: '#2563eb', letterSpacing: '-1px' }}>TripPuddy</div>
        <div style={{ display: 'flex', gap: '30px' }}>
          <a href="/" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>Home</a>
          <a href="/my-trips" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>My Trips</a>
          <a href="/contact" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>Contact</a>
        </div>
      </nav>

      <div style={{ 
        backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url('${heroImage}')`, 
        backgroundSize: 'cover', backgroundPosition: 'center', height: '85vh', 
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white'
      }}>
        <h1 style={{ fontSize: '4rem', fontWeight: '900', marginBottom: '10px' }}>Plan Your Adventure</h1>
        
        <div style={{ width: '100%', maxWidth: '650px', marginTop: '30px' }}>
          <div style={{ backgroundColor: 'white', padding: '2px', borderRadius: '60px', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', overflow: 'hidden' }}>
            <input 
              type="text" placeholder="Where do you want to go?" 
              value={searchPrompt} onChange={(e) => setSearchPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch('/itinerary')}
              style={{ flex: 1, border: 'none', padding: '20px', fontSize: '18px', outline: 'none', textAlign: 'center', color: '#333' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button onClick={() => handleSearch('/itinerary')} style={{ ...chatbotButtonStyle, backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid white' }}>🚀 AI Instant Itinerary</button>
            
            {/* CẬP NHẬT: Nút AI Custom Plan dẫn đến /chat */}
            <button onClick={() => router.push('/chat')} style={{ ...chatbotButtonStyle, backgroundColor: '#059669' }}>🎨 AI Custom Plan</button>
          </div>
        </div>
      </div>

      <section style={{ padding: '80px 5%', maxWidth: '1400px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '50px', textAlign: 'center', fontWeight: '900' }}>Featured Destinations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
          {randomDestinations.map((city) => (
            <div key={city.name} style={{ backgroundColor: 'white', borderRadius: '35px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
              <div onClick={() => setSelectedImage(city.image)} style={{ height: '300px', cursor: 'zoom-in', overflow: 'hidden' }}>
                <img src={city.image} alt={city.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: '0.3s' }} 
                     onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                     onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}/>
              </div>
              <div style={{ padding: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                  <div>
                    <h3 style={{ margin: '0', fontSize: '1.5rem', color: '#1e3a8a' }}>{city.name}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{city.region}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <a href={city.guide} target="_blank" rel="noopener noreferrer" 
                       style={{ ...chatbotButtonStyle, padding: '6px 14px', backgroundColor: '#6366f1', fontSize: '12px', borderRadius: '15px', display: 'block', marginBottom: '5px' }}>
                      Travel Guide
                    </a>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                      <span>{city.icon}</span>
                      <span>{city.temp}</span>
                    </div>
                  </div>
                </div>
                
                <a href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city.name)}&aid=${affiliateId}`} 
                   target="_blank" rel="noopener noreferrer" 
                   style={{ ...chatbotButtonStyle, width: '100%', textAlign: 'center', fontSize: '16px', padding: '15px 0', marginTop: '15px' }}>
                  Book Hotels
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FLOATING BUTTON: Đã đổi tên thành "Your AI assistant" và dẫn đến /ai-assistant */}
      <a 
        href="/ai-assistant" 
        style={{
          position: 'fixed', bottom: '30px', right: '30px', width: '65px', height: '65px',
          backgroundColor: '#f59e0b', borderRadius: '50%', display: 'flex', justifyContent: 'center',
          alignItems: 'center', boxShadow: '0 10px 25px rgba(245, 158, 11, 0.4)', zIndex: 3000,
          textDecoration: 'none', fontSize: '28px', transition: '0.3s'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        🤖
        <span style={{
          position: 'absolute', right: '75px', backgroundColor: 'white', padding: '8px 15px',
          borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', color: '#333',
          whiteSpace: 'nowrap', boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
        }}>
          Your AI assistant ✨
        </span>
      </a>

      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'zoom-out' }}>
          <img src={selectedImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '15px', border: '5px solid white' }} alt="Selected" />
        </div>
      )}

      <footer style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <p>© 2026 TripPuddy. Developed for 🇦🇺 & 🇻🇳 Citizens.</p>
      </footer>
    </div>
  );
}