"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Đảm bảo đường dẫn này đúng với dự án của bạn
import Link from 'next/link';

export default function MyTrips() {
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    const fetchTrips = async () => {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) setTrips(data);
    };
    fetchTrips();
  }, []);

  // --- ĐỊNH NGHĨA STYLE Ở ĐÂY ---
  const listContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '30px'
  };

  const cardStyle = {
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s',
    cursor: 'pointer'
  };

  const linkStyle = {
    textDecoration: 'none',
    color: 'inherit'
  };

  return (
    <div style={{ padding: '100px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#1e3a8a', fontSize: '2rem' }}>My Saved Trips ✈️</h1>
      <p>Chào Citizen Úc-Việt! Đây là những hành trình bạn đã lưu.</p>

      <div style={listContainerStyle}>
        {trips.length > 0 ? (
          trips.map(trip => (
            <Link href={`/itinerary/${trip.id}`} key={trip.id} style={linkStyle}>
              <div 
                style={cardStyle}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#1d4ed8' }}>{trip.title || "Untitled Trip"}</h3>
                <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                  📅 Created: {new Date(trip.created_at).toLocaleDateString()}
                </p>
                <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                  👁️ Views: {trip.view_count || 0}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <p>Bạn chưa có chuyến đi nào. Hãy thử tạo một chuyến đi với AI nhé!</p>
        )}
      </div>
    </div>
  );
}