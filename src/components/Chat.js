'use client'
import { useEffect, useRef, useState } from 'react'
import MicButton from './MicButton'

export default function Chat({ onNewDestinations, likedPlaces = [], dislikedPlaces = [] }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  const renderContent = (content) => {
    if (!content) return null;
    return content.split('\n').map((line, i) => {
      if (line.startsWith('DAY')) {
        return <h4 key={i} className="text-[#10b981] font-bold mt-4 border-b border-gray-200 pb-1">{line}</h4>;
      }
      return <p key={i} className="my-1 text-sm text-gray-700">{line}</p>;
    });
  };

  async function sendMessage(e, voiceText, isFinal = false) {
    if (e) e.preventDefault()
    const text = isFinal ? "Finalize my itinerary" : (voiceText || input || '').trim()
    if (!text && !isFinal) return

    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history); setInput(''); setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, likedPlaces, dislikedPlaces, isFinalizing: isFinal })
      });
      const data = await res.json();
      setMessages([...history, { role: 'assistant', content: data.reply || '' }]);
      if (data.destinations?.length > 0) onNewDestinations(data.destinations);
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "Lỗi kết nối!" }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.createItinerary = () => sendMessage(null, null, true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-full flex flex-col p-4 bg-white rounded-[30px]">
      <div className="h-[300px] overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.length === 0 && <p className="text-center text-gray-400 text-sm mt-10 italic">Hãy chat gì đó để bắt đầu...</p>}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${
              msg.role === 'user' ? 'bg-[#10b981] text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs italic text-gray-400 animate-pulse">TripPuddy đang trả lời...</div>}
        <div ref={bottomRef}></div>
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t pt-4">
        <MicButton onResult={(t) => sendMessage(null, t)} />
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 bg-gray-50 p-3 rounded-xl outline-none text-sm border border-gray-200"
        />
        <button type="submit" className="bg-gray-900 text-white px-6 rounded-xl font-bold">Gửi</button>
      </form>
    </div>
  )
}