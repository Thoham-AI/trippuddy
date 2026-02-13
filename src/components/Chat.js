'use client'
import { useEffect, useRef, useState } from 'react'
import MicButton from './MicButton'

export default function Chat({ onNewDestinations, likedPlaces = [], dislikedPlaces = [] }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userTitle, setUserTitle] = useState('Boss')
  const [customTitleDraft, setCustomTitleDraft] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const bottomRef = useRef(null)

  // Hàm quan trọng để hiển thị Itinerary đẹp mắt
  const renderContent = (content) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('DAY')) {
        return <h4 key={i} style={{ color: '#0ea5a4', fontWeight: 'bold', marginTop: '15px', borderBottom: '1px solid #eee' }}>{line}</h4>;
      }
      return <p key={i} style={{ margin: '5px 0', fontSize: '14px' }}>{line}</p>;
    });
  };

  const handleSaveTitle = () => {
    if (customTitleDraft.trim()) {
      setUserTitle(customTitleDraft.trim());
      setIsCustomMode(false);
    }
  };

  async function sendMessage(e, voiceText, isFinal = false) {
    if (e) e.preventDefault()
    const text = isFinal ? "Please finalize my travel itinerary." : (voiceText || input || '').trim()
    if (!text && !isFinal) return

    const history = [...messages, { role: 'user', content: text }]
    setMessages(history); setInput(''); setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userTitle, likedPlaces, dislikedPlaces, isFinalizing: isFinal })
      });
      const data = await res.json();
      if (data.destinations?.length > 0) onNewDestinations(data.destinations);
      setMessages([...history, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "⚠️ Error connecting..." }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.createItinerary = () => sendMessage(null, null, true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, likedPlaces, dislikedPlaces]);

  return (
    <div className="chat-wrapper" style={{ background: '#f8fafc', borderRadius: '20px', padding: '20px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b' }}>TripPuddy 💬</h2>
        <select 
          value={isCustomMode ? "Custom" : (['Boss','Sir','Honey','Madam','Friend'].includes(userTitle) ? userTitle : "Custom")}
          onChange={(e) => e.target.value === 'Custom' ? setIsCustomMode(true) : (setUserTitle(e.target.value), setIsCustomMode(false))}
          style={{ padding: '8px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
        >
          {['Boss','Sir','Honey','Madam','Friend'].map(t => <option key={t} value={t}>{t}</option>)}
          <option value="Custom">Tên riêng...</option>
        </select>
      </div>

      {isCustomMode && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
          <input value={customTitleDraft} onChange={e => setCustomTitleDraft(e.target.value)} placeholder="Nhập tên..." style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid #0ea5a4' }} />
          <button onClick={handleSaveTitle} style={{ background: '#0ea5a4', color: 'white', padding: '10px 20px', borderRadius: '10px', border: 'none' }}>Lưu</button>
        </div>
      )}

      <div style={{ height: '400px', overflowY: 'auto', paddingRight: '10px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '15px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', padding: '12px 16px', borderRadius: '18px', 
              background: msg.role === 'user' ? '#0ea5a4' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#334155',
              boxShadow: msg.role === 'assistant' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
              maxWidth: '85%', textAlign: 'left'
            }}>
              {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ color: '#64748b', fontSize: '13px' }}>TripPuddy đang thiết kế lịch trình...</div>}
        <div ref={bottomRef}></div>
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <MicButton onResult={t => sendMessage(null, t)} />
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Chat với mình nhé..." style={{ flex: 1, padding: '12px', borderRadius: '15px', border: '1px solid #e2e8f0' }} />
        <button type="submit" style={{ background: '#0ea5a4', color: 'white', padding: '12px 24px', borderRadius: '15px', border: 'none', fontWeight: 'bold' }}>Gửi</button>
      </form>
    </div>
  )
}