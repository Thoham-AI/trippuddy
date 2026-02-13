'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import MicButton from './MicButton'
// ... các import khác giữ nguyên

const PRESET_TITLES = ['Boss', 'Sir', 'Honey', 'Madam', 'Friend'];

export default function Chat({ onNewDestinations }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  // 1. Khởi tạo mặc định là 'Boss', không lấy từ localStorage nữa
  const [userTitle, setUserTitle] = useState('Boss')
  const [customTitleDraft, setCustomTitleDraft] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false) 

  const bottomRef = useRef(null)

  // 2. Logic xử lý khi chọn Dropdown
  const handleTitleChange = (val) => {
    if (val === 'Custom') {
      setIsCustomMode(true);
      setUserTitle(''); // Xóa title hiện tại để người dùng nhập mới
    } else {
      setIsCustomMode(false);
      setUserTitle(val);
    }
  };

  // 3. Xác định giá trị hiển thị trên select
  const titleSelectValue = useMemo(() => {
    if (isCustomMode || !PRESET_TITLES.includes(userTitle)) return 'Custom';
    return userTitle;
  }, [userTitle, isCustomMode]);

  // Hàm lưu tên tạm thời cho phiên làm việc này (không dùng localStorage)
  function applyCustomTitle() {
    if (customTitleDraft.trim()) {
      setUserTitle(customTitleDraft.trim());
      setIsCustomMode(false);
      setCustomTitleDraft(''); // Xóa nháp sau khi lưu
    }
  }

  // --- Giữ nguyên các hàm useEffect cho Location và Tin nhắn ---

  async function sendMessage(e, voiceText) {
    if (e) e.preventDefault()
    const text = (voiceText || input || '').trim()
    if (!text) return

    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history); setInput(''); setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          userTitle: userTitle || "Guest" // Gửi tên đã chọn cho AI
        })
      });

      const data = await res.json();
      if (data.destinations?.length > 0) {
        onNewDestinations(data.destinations);
      }
      setMessages([...history, { role: 'assistant', content: data.reply || "Done!" }]);
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "⚠️ Error kết nối." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-wrapper">
      <div className="chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 900 }}>TripPuddy Chat 💬</div>
        
        {/* Dropdown chọn danh xưng */}
        <select 
          value={titleSelectValue} 
          onChange={(e) => handleTitleChange(e.target.value)} 
          style={{ padding: '6px', borderRadius: 10 }}
        >
          {PRESET_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
          <option value="Custom">Custom…</option>
        </select>
      </div>

      {/* Ô nhập Custom hiện ra khi chọn 'Custom...' hoặc khi Title chưa xác định */}
      {isCustomMode && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input 
            value={customTitleDraft} 
            onChange={(e) => setCustomTitleDraft(e.target.value)} 
            placeholder="Bạn muốn được gọi là gì?" 
            style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid #cbd5e1' }} 
          />
          <button 
            onClick={applyCustomTitle} 
            style={{ padding: '10px 14px', borderRadius: 12, background: '#0ea5a4', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Lưu tên
          </button>
        </div>
      )}

      {/* ... Phần hiển thị tin nhắn và input giữ nguyên ... */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`}>{msg.content}</div>
        ))}
        {loading && <div className="typing-indicator"><span></span><span></span><span></span></div>}
        <div ref={bottomRef}></div>
      </div>

      <form className="chat-input" onSubmit={sendMessage}>
        <MicButton onResult={(t) => sendMessage(undefined, t)} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Hỏi TripPuddy bất cứ điều gì..." />
        <button type="submit" className="send-btn">Send</button>
      </form>
    </div>
  )
}