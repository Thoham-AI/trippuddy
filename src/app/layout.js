// src/app/layout.js
'use client';

import { useState, useEffect } from 'react';
import "./globals.css";
import Navbar from "@/components/Navbar";
import Script from "next/script";

export default function RootLayout({ children }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    // Hàm kiểm tra trạng thái âm thanh từ cả hệ thống và localStorage
    const checkStatus = () => {
      if (typeof window !== 'undefined') {
        const synthSpeaking = window.speechSynthesis.speaking;
        const storageSpeaking = localStorage.getItem('ai_speaking') === 'true';
        
        // Nếu trình duyệt đang đọc hoặc cờ storage đang bật
        if (synthSpeaking || storageSpeaking) {
          setIsSpeaking(true);
        } else {
          setIsSpeaking(false);
        }
      }
    };

    // Kiểm tra liên tục mỗi 300ms để đảm bảo nút hiện/ẩn nhạy bén
    const interval = setInterval(checkStatus, 300);

    // Lắng nghe sự kiện thay đổi storage từ các tab/trang khác
    window.addEventListener('storage', checkStatus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkStatus);
    };
  }, []);

  const handleStopAudio = (e) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      localStorage.setItem('ai_speaking', 'false'); // Hạ cờ ngay lập tức
      setIsSpeaking(false);
    }
  };

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                  var script = document.createElement("script");
                  script.async = 1;
                  script.src = 'https://emrldtp.com/NDgwNzQz.js?t=480743';
                  document.head.appendChild(script);
              })();
            `,
          }}
        />
      </head>

      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased relative">
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-REY8TNY6DC" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-REY8TNY6DC');
          `}
        </Script>

        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>

        {/* Cấu trúc nút nổi cố định */}
        <div style={{ 
          position: 'fixed', bottom: '30px', right: '30px', zIndex: 10000, 
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' 
        }}>
          
          {/* NÚT STOP: Xuất hiện dựa trên trạng thái isSpeaking */}
          {isSpeaking && (
            <button 
              onClick={handleStopAudio}
              style={{
                backgroundColor: '#ff4d4f', color: 'white', border: 'none', 
                padding: '10px 18px', borderRadius: '50px', fontSize: '14px', 
                fontWeight: 'bold', cursor: 'pointer', display: 'flex', 
                alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(255, 77, 79, 0.4)',
                animation: 'bounce 1s infinite'
              }}
            >
              <span>Dừng đọc</span> 🔇
            </button>
          )}

          {/* NÚT ROBOT CHÍNH */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span className="label-popup" style={{
              marginRight: '15px', backgroundColor: 'white', padding: '8px 15px',
              borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', color: '#333',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)', opacity: 0, transition: '0.3s',
              pointerEvents: 'none', border: '1px solid #eee', whiteSpace: 'nowrap'
            }}>
              Your AI assistant ✨
            </span>

            <a 
              href="/ai-assistant" 
              onMouseEnter={(e) => {
                const label = e.currentTarget.parentElement.querySelector('.label-popup');
                if (label) label.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                const label = e.currentTarget.parentElement.querySelector('.label-popup');
                if (label) label.style.opacity = '0';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              style={{
                width: '65px', height: '65px', backgroundColor: '#f59e0b', 
                borderRadius: '50%', display: 'flex', justifyContent: 'center', 
                alignItems: 'center', fontSize: '30px', transition: '0.3s',
                boxShadow: '0 10px 25px rgba(245, 158, 11, 0.4)', textDecoration: 'none'
              }}
            >
              🤖
            </a>
          </div>
        </div>

        <style jsx global>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
        `}</style>
      </body>
    </html>
  );
}