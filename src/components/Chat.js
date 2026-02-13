'use client'
import { useEffect, useRef, useState } from 'react'
import MicButton from './MicButton'

export default function Chat({ onNewDestinations }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  // State quản lý danh xưng
  const [userTitle, setUserTitle] = useState('Boss')
  const [customTitleDraft, setCustomTitleDraft] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)

  const bottomRef = useRef(null)
  const presets = ['Boss', 'Sir', 'Honey', 'Madam', 'Friend']

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleTitleChange = (val) => {
    if (val === 'Custom') {
      setIsCustomMode(true);
      setUserTitle(''); // Để trống để chờ nhập
    } else {
      setIsCustomMode(false);
      setUserTitle(val);
    }
  }

  async function sendMessage(e, voiceText) {
    if (e) e.preventDefault()
    const text = (voiceText || input || '').trim()
    if (!text) return

    // Lấy tên cuối cùng: nếu đang gõ custom thì dùng nháp, nếu chọn preset thì dùng preset
    const finalTitleToSend = isCustomMode ? (customTitleDraft || 'Guest') : userTitle;

    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: history, 
          userTitle: finalTitleToSend 
        })
      })

      const data = await res.json()
      if (data.destinations?.length > 0) {
        onNewDestinations(data.destinations)
      }
      setMessages([...history, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "⚠️ Có lỗi rồi Boss ơi!" }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-wrapper" style={{ width: '100%', padding: '10px' }}>
      <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ fontWeight: '900', fontSize: '20px' }}>TripPuddy 💬</h3>
        <select 
          value={isCustomMode ? "Custom" : userTitle} 
          onChange={(e) => handleTitleChange(e.target.value)}
          style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ccc' }}
        >
          {presets.map(t => <option key={t} value={t}>{t}</option>)}
          <option value="Custom">Custom...</option>
        </select>
      </div>

      {isCustomMode && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
          <input 
            value={customTitleDraft} 
            onChange={(e) => setCustomTitleDraft(e.target.value)}
            placeholder="Bạn muốn được gọi là gì?"
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid #0ea5e9' }}
          />
          <button 
            onClick={() => { if(customTitleDraft) setIsCustomMode(false) }}
            style={{ padding: '10px 15px', background: '#0ea5e9', color: 'white', borderRadius: '10px', border: 'none' }}
          >
            Lưu
          </button>
        </div>
      )}

      <div className="chat-messages" style={{ height: '350px', overflowY: 'auto', background: '#fff', borderRadius: '15px', padding: '15px', marginBottom: '15px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`} style={{ marginBottom: '10px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <span style={{ 
              display: 'inline-block', 
              padding: '10px', 
              borderRadius: '12px', 
              background: msg.role === 'user' ? '#0ea5e9' : '#f1f5f9',
              color: msg.role === 'user' ? '#fff' : '#000'
            }}>
              {msg.content}
            </span>
          </div>
        ))}
        {loading && <div style={{ fontSize: '12px', color: '#888' }}>TripPuddy đang trả lời...</div>}
        <div ref={bottomRef}></div>
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
        <MicButton onResult={(t) => sendMessage(null, t)} />
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Nhập tin nhắn..."
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ddd' }}
        />
        <button type="submit" style={{ padding: '10px 20px', background: '#0ea5e9', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 'bold' }}>Gửi</button>
      </form>
    </div>
  )
}