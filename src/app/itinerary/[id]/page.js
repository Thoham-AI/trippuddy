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
        // Tăng lượt xem tự động mỗi khi truy cập
        await supabase
          .from('itineraries')
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq('id', id);
      }
      setLoading(false);
    };
    if (id) fetchDetail();
  }, [id]);

  // --- HỆ THỐNG STYLE (CSS-in-JS) ---
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
    backgroundColor: '#003580', // Màu xanh đặc trưng của Booking
    color: 'white',
    borderRadius: '12px',
    fontWeight: '700',
    textDecoration: 'none',
    fontSize: '1.2rem',
    boxShadow: '0 4px 12px rgba(0, 53, 128, 0.3)',
    transition: 'all 0.3s ease'
  };

  // --- HÀM RENDER NỘI DUNG THÔNG MINH ---
  const renderItineraryContent = () => {
    const content = itinerary.content;
    
    // Trường hợp 1: Dữ liệu là Object có thuộc tính days (Lý tưởng nhất)
    if (typeof content === 'object' && content !== null && content.days) {
      return content.days.map((day, index) => (
        <div key={index} style={dayCardStyle}>
          <div style={dayBadgeStyle}>{index + 1}</div>
          <h3 style={{ marginTop: 0, color: '#1e3a8a', fontSize: '1.0rem' }}>
            Ngày {index + 1}: {day.title || "Khám phá"}
          </h3>
          <p style={{ color: '#374151', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>
            {day.activity || day.description}
          </p>
        </div>
      ));
    }

    // Trường hợp 2: Dữ liệu là Text thuần (AI đời cũ hoặc format lỗi)
    return (
      <div style={{ whiteSpace: 'pre-wrap', color: '#374151', lineHeight: '1.8' }}>
        {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
      </div>
    );
  };

  if (loading) return <div style={containerStyle}>☕ Đang chuẩn bị hành trình cho bạn...</div>;
  if (!itinerary) return <div style={containerStyle}>❌ Không tìm thấy dữ liệu chuyến đi.</div>;

  return (
    <div style={containerStyle}>
      {/* Tiêu đề & Thông tin phụ */}
      <h1 style={{ color: '#111827', fontSize: '1.5rem', marginBottom: '10px', fontWeight: '800' }}>
        {itinerary.title || "Hành trình du lịch"}
      </h1>
      
      <div style={infoHeaderStyle}>
        <span>📅 Ngày tạo: {new Date(itinerary.created_at).toLocaleDateString('vi-VN')}</span>
        <span>🔥 {itinerary.view_count || 0} lượt xem</span>
      </div>

      {/* Vùng hiển thị Lịch trình */}
      <div style={timelineContainerStyle}>
        <h2 style={{ color: '#1e40af', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🗺️ Chi tiết lịch trình
        </h2>
        {renderItineraryContent()}
      </div>
      
      {/* Nút Booking "Hái ra tiền" */}
      <a 
        href="https://www.booking.com/index.html?aid=480743" 
        target="_blank" 
        rel="noopener noreferrer"
        style={bookingButtonStyle}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#00224f';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#003580';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        🏨 Đặt khách sạn giá tốt tại Booking.com
      </a>

      <p style={{ textAlign: 'center', marginTop: '20px', color: '#6b7280', fontSize: '0.85rem' }}>
        Cảm ơn bạn đã sử dụng TripPuddy! Chúc bạn có một chuyến đi tuyệt vời. 🇦🇺 🇻🇳
      </p>
    </div>
  );
}