"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ItineraryDetail() {
  const { id } = useParams();
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error && data) {
        setItinerary(data);
        // Automatically increment view count on access
        await supabase
          .from('itineraries')
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq('id', id);
      }
      setLoading(false);
    };
    if (id) fetchDetail();
  }, [id]);

  // --- STYLING SYSTEM (CSS-in-JS) ---
  const containerStyle = {
    padding: '100px 20px',
    maxWidth: '850px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const infoHeaderStyle = {
    display: 'flex',
    gap: '15px',
    color: '#6b7280',
    fontSize: '0.9rem',
    marginBottom: '25px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '15px'
  };

  const timelineContainerStyle = {
    backgroundColor: '#ffffff',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    marginBottom: '30px'
  };

  const dayCardStyle = {
    borderLeft: '4px solid #3b82f6',
    paddingLeft: '25px',
    marginBottom: '40px',
    position: 'relative',
  };

  const dayBadgeStyle = {
    position: 'absolute',
    left: '-14px',
    top: '0',
    backgroundColor: '#3b82f6',
    color: 'white',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold'
  };

  const bookingButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '18px',
    backgroundColor: '#003580', // Booking.com blue
    color: 'white',
    borderRadius: '12px',
    fontWeight: '700',
    textDecoration: 'none',
    fontSize: '1.2rem',
    boxShadow: '0 4px 12px rgba(0, 53, 128, 0.3)',
    transition: 'all 0.3s ease'
  };

  // --- SMART CONTENT RENDERER ---
  const renderItineraryContent = () => {
    const content = itinerary.content;
    
    // Case 1: Data is an object with a 'days' property (Ideal)
    if (typeof content === 'object' && content !== null && content.days) {
      return content.days.map((day, index) => (
        <div key={index} style={dayCardStyle}>
          <div style={dayBadgeStyle}>{index + 1}</div>
          <h3 style={{ marginTop: 0, color: '#1e3a8a', fontSize: '1.0rem' }}>
            Day {index + 1}: {day.title || "Explore"}
          </h3>
          <p style={{ color: '#374151', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>
            {day.activity || day.description}
          </p>
        </div>
      ));
    }

    // Case 2: Raw Text (Older AI versions or format error)
    return (
      <div style={{ whiteSpace: 'pre-wrap', color: '#374151', lineHeight: '1.8' }}>
        {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
      </div>
    );
  };

  if (loading) return <div style={containerStyle}>☕ Preparing your journey...</div>;
  if (!itinerary) return <div style={containerStyle}>❌ Trip data not found.</div>;

  return (
    <div style={containerStyle}>
      {/* Title & Meta Info */}
      <h1 style={{ color: '#111827', fontSize: '1.5rem', marginBottom: '10px', fontWeight: '800' }}>
        {itinerary.title || "Travel Itinerary"}
      </h1>
      
      <div style={infoHeaderStyle}>
        <span>📅 Created: {new Date(itinerary.created_at).toLocaleDateString('en-AU')}</span>
        <span>🔥 {itinerary.view_count || 0} views</span>
      </div>

      {/* Itinerary Timeline Area */}
      <div style={timelineContainerStyle}>
        <h2 style={{ color: '#1e40af', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🗺️ Itinerary Details
        </h2>
        {renderItineraryContent()}
      </div>
      
      {/* Smart Booking Button */}
      <a 
        href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(itinerary.title)}&aid=480743&lang=en-gb`}
        target="_blank" 
        rel="noopener noreferrer"
        style={bookingButtonStyle}
        onClick={() => {
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'click_booking_affiliate', {
              'event_category': 'affiliate',
              'event_label': itinerary?.title,
              'value': 1
            });
          }
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#00224f';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#003580';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        🏨 Book Best Hotels in {itinerary.title.split(' ').pop()} at Booking.com
      </a>

      {/* AFFILIATE DISCLOSURE */}
      <p style={{ 
        textAlign: 'center', 
        marginTop: '12px', 
        color: '#9ca3af', 
        fontSize: '0.75rem',
        fontStyle: 'italic',
        lineHeight: '1.4'
      }}>
        Note: As a Booking.com associate, TripPuddy may earn a small commission from qualifying purchases made through this link. This helps us keep the system free for you.<br/>
        <span style={{ fontSize: '0.7rem' }}>(As a Booking.com associate, I earn from qualifying purchases)</span>
      </p>

      <p style={{ textAlign: 'center', marginTop: '20px', color: '#6b7280', fontSize: '0.85rem' }}>
        Thank you for using TripPuddy! Have an amazing trip. 🇦🇺 🇻🇳
      </p>
    </div>
  );
}