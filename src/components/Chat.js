'use client'
import { useEffect, useRef, useState } from 'react'
import MicButton from './MicButton'

export default function Chat({ onNewDestinations, likedPlaces = [], dislikedPlaces = [] }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false) // Quản lý trạng thái đang đọc
  const bottomRef = useRef(null)

  // --- HÀM ĐỌC VĂN BẢN (TEXT-TO-SPEECH) ---
  const speak = (text) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Hủy các câu đang đọc dở để tránh chồng chéo
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Tự động nhận diện ngôn ngữ (Ưu tiên tiếng Việt cho Boss)
      utterance.lang = 'vi-VN'; 
      utterance.pitch = 1;
      utterance.rate = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  async function sendMessage(e, voiceText, isFinal = false) {
    if (e) e.preventDefault()
    
    // Dừng đọc ngay khi người dùng bắt đầu gửi câu hỏi mới
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const textToSubmit = voiceText || input;
    const text = isFinal ? "Finalize my itinerary" : (textToSubmit || '').trim()
    
    if (!text && !isFinal) return

    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    
    setMessages(history)
    setInput('') 
    setLoading(true)

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: history, 
          likedPlaces, 
          dislikedPlaces, 
          isFinalizing: isFinal, 
          userTitle: "Boss" 
        })
      });
      
      const data = await res.json();
      const aiReply = data.reply || '';
      
      const newHistory = [...history, { role: 'assistant', content: aiReply }];
      setMessages(newHistory);
      
      // --- AI TỰ ĐỘNG ĐỌC CÂU TRẢ LỜI ---
      speak(aiReply);

      if (data.destinations?.length > 0 && typeof onNewDestinations === 'function') {
        onNewDestinations(data.destinations);
      }
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "Lỗi kết nối rồi Boss ơi!" }]);
    } finally {
      setLoading(false);
    }
  }

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-full flex flex-col h-full bg-white rounded-[30px] shadow-xl border border-gray-100 overflow-hidden">
      
      {/* NỘI DUNG CHAT (SCROLLABLE) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="text-center mt-20 text-gray-400">
            <p className="text-4xl mb-2">🤖</p>
            <p className="text-sm italic">Chào Boss! TripPuddy đã sẵn sàng nghe lệnh.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] animate-in fade-in slide-in-from-bottom-2 ${
              msg.role === 'user' 
                ? 'bg-[#10b981] text-white rounded-tr-none' 
                : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex items-center gap-2 text-xs italic text-gray-400 animate-pulse ml-2">
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
            TripPuddy đang xử lý...
          </div>
        )}
        <div ref={bottomRef}></div>
      </div>

      {/* THANH NHẬP LIỆU (ALWAYS VISIBLE AT BOTTOM) */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t flex items-center gap-3">
        <div className="flex-shrink-0 bg-gray-100 rounded-full p-1 hover:bg-gray-200 transition-colors">
          {/* onResult gọi trực tiếp sendMessage để tự động gửi ngay khi nói xong */}
          <MicButton onResult={(t) => sendMessage(null, t)} />
        </div>
        
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hỏi bất cứ điều gì..."
          className="flex-1 bg-gray-50 p-3 rounded-2xl outline-none text-sm border border-transparent focus:border-[#10b981] transition-all"
          disabled={loading}
        />
        
        <button 
          type="submit" 
          disabled={loading || !input.trim()}
          className="bg-gray-900 text-white p-3 px-6 rounded-2xl font-bold hover:bg-black transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? '...' : 'Gửi'}
        </button>

        {/* Nút dừng đọc nhanh nếu AI đang nói quá dài */}
        {isSpeaking && (
          <button 
            type="button"
            onClick={() => window.speechSynthesis.cancel()}
            className="p-2 text-red-500 hover:bg-red-50 rounded-full"
            title="Dừng đọc"
          >
            Stop 🔇
          </button>
        )}
      </form>
    </div>
  )
}