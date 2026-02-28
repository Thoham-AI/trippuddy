"use client";
import React, { useState } from 'react';
import Chat from '@/components/Chat'; 

export default function AIAssistantPage() {
  const [destinations, setDestinations] = useState([]);

  return (
    <div style={{ 
      backgroundColor: '#f3f4f6', 
      height: '100vh', // Cố định chiều cao toàn màn hình
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden' // Ngăn toàn bộ trang bị cuộn
    }}>
      
      {/* NAVBAR: Cố định phía trên */}
      <nav style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '15px 5%', 
        alignItems: 'center', 
        backgroundColor: 'white', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        flexShrink: 0 // Không cho Navbar bị co lại
      }}>
        <div style={{ fontSize: '26px', fontWeight: '900', color: '#2563eb' }}>TripPuddy</div>
        <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
          <a href="/" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>Home</a>
          <a href="/my-trips" style={{ textDecoration: 'none', color: '#374151', fontWeight: '600' }}>My Trips</a>
          <span style={{ backgroundColor: '#eef2ff', color: '#2563eb', padding: '5px 12px', borderRadius: '15px', fontSize: '14px', fontWeight: 'bold' }}>
            AI Mode ✨
          </span>
        </div>
      </nav>

      {/* MAIN CHAT AREA: Khu vực này sẽ chiếm toàn bộ phần còn lại */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '20px 5% 10px 5%', // Padding dưới ít lại để Prompt box sát đáy hơn
        overflow: 'hidden', // Quan trọng: Khung main không được cuộn
        position: 'relative'
      }}>
        
        {/* CONTAINER CHAT TẬP TRUNG */}
        <div style={{ 
          width: '100%', 
          maxWidth: '1000px', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'white',
          borderRadius: '20px 20px 0 0', // Bo góc trên, dưới để thẳng cho Prompt Box
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
          height: '100%', // Chiếm hết chiều cao vùng Main
          overflow: 'hidden' // Đảm bảo nội dung con không tràn ra ngoài
        }}>
          {/* LƯU Ý: Để phần tin nhắn cuộn được, Boss cần vào component <Chat /> 
              và đảm bảo div bọc danh sách tin nhắn có:
              height: 100%, overflowY: 'auto', display: 'flex', flexDirection: 'column'
          */}
          <Chat onNewDestinations={(data) => setDestinations(data)} />
        </div>

      </main>

      {/* FOOTER & ABN: Giữ nhỏ gọn để không chiếm chỗ */}
      <footer style={{ 
        padding: '10px', 
        textAlign: 'center', 
        color: '#64748b', 
        fontSize: '11px', 
        backgroundColor: '#f3f4f6',
        flexShrink: 0 
      }}>
        <p>© 2026 TripPuddy. ABN: [Số ABN của Boss]. Developed for 🇦🇺 & 🇻🇳 Citizens.</p>
      </footer>
    </div>
  );
}