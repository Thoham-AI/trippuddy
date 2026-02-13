'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import MicButton from './MicButton'
import { supabase } from '@/lib/supabase'

const TITLE_STORAGE_KEY = 'trippuddy_user_title';
const PRESET_TITLES = ['Boss', 'Sir', 'Honey', 'Madam', 'Friend'];

export default function Chat({ onNewDestinations }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userTitle, setUserTitle] = useState('Boss')
  const [customTitleDraft, setCustomTitleDraft] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false) // State mới để quản lý ô nhập liệu
  const bottomRef = useRef(null)

  // Xử lý khi chọn dropdown
  const handleTitleChange = (val) => {
    if (val === 'Custom') {
      setIsCustomMode(true);
      setUserTitle(''); // Tạm xóa title để hiện ô nhập
    } else {
      setIsCustomMode(false);
      persistTitle(val);
    }
  };

  const titleSelectValue = useMemo(() => {
    if (isCustomMode) return 'Custom';
    if (PRESET_TITLES.includes(userTitle)) return userTitle;
    return 'Custom';
  }, [userTitle, isCustomMode]);

  useEffect(() => {
    const stored = localStorage.getItem(TITLE_STORAGE_KEY);
    if (stored) setUserTitle(stored);
  }, []);

  function persistTitle(v) {
    const val = (v || '').trim() || 'Boss';
    setUserTitle(val);
    localStorage.setItem(TITLE_STORAGE_KEY, val);
    setIsCustomMode(false);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

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
        body: JSON.stringify({ messages: history, userTitle })
      });

      const data = await res.json();
      if (data.destinations?.length > 0) {
        onNewDestinations(data.destinations);
      }
      setMessages([...history, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "⚠️ Error kết nối." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-wrapper">
      <div className="chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>TripPuddy Chat 💬</div>
        <select 
          value={titleSelectValue} 
          onChange={(e) => handleTitleChange(e.target.value)} 
          style={{ padding: '6px', borderRadius: 10 }}
        >
          {PRESET_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
          <option value="Custom">Custom…</option>
        </select>
      </div>

      {/* Ô nhập Custom hiện ra ở đây */}
      {isCustomMode && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input 
            value={customTitleDraft} 
            onChange={(e) => setCustomTitleDraft(e.target.value)} 
            placeholder="Type your name..." 
            style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid #cbd5e1' }} 
          />
          <button 
            onClick={() => persistTitle(customTitleDraft)} 
            style={{ padding: '10px 14px', borderRadius: 12, background: '#0ea5a4', color: 'white', border: 'none' }}
          >
            Save
          </button>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`}>{msg.content}</div>
        ))}
        {loading && <div className="typing-indicator"><span></span><span></span><span></span></div>}
        <div ref={bottomRef}></div>
      </div>

      <form className="chat-input" onSubmit={sendMessage}>
        <MicButton onResult={(t) => sendMessage(undefined, t)} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask TripPuddy..." />
        <button type="submit" className="send-btn">Send</button>
      </form>
    </div>
  )
}