'use client'
import { useEffect, useRef, useState } from 'react'
import MicButton from './MicButton'

export default function Chat({ onNewDestinations, likedPlaces = [], dislikedPlaces = [] }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [autoReadNext, setAutoReadNext] = useState(false); // Cờ để biết có nên tự động đọc không
  const bottomRef = useRef(null)

  // --- HÀM ĐỌC VĂN BẢN (TEXT-TO-SPEECH) ---
  const speak = (text) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        (v.lang === 'vi-VN' && v.name.includes('Natural')) || 
        (v.lang === 'vi-VN' && v.name.includes('Google'))
      );

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.pitch = 1.1;
      utterance.rate = 0.95;

      // Cập nhật trạng thái cho Layout.js nhận diện nút Stop
      utterance.onstart = () => {
        setIsSpeaking(true);
        localStorage.setItem('ai_speaking', 'true');
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        localStorage.setItem('ai_speaking', 'false');
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  async function sendMessage(e, voiceText, isFinal = false) {
    if (e) e.preventDefault()
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      localStorage.setItem('ai_speaking', 'false');
    }

    // Kiểm tra xem tin nhắn đến từ Mic hay từ Input gõ tay
    const isFromVoice = !!voiceText;
    setAutoReadNext(isFromVoice); // Nếu là voiceText thì sẽ tự động đọc câu trả lời sau đó

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
      
      // --- CHỈ TỰ ĐỘNG ĐỌC NẾU KHÁCH DÙNG MIC ---
      if (isFromVoice) {
        speak(aiReply);
      }

      if (data.destinations?.length > 0 && typeof onNewDestinations === 'function') {
        onNewDestinations(data.destinations);
      }
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "Lỗi kết nối rồi Boss ơi!" }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-full flex flex-col h-full bg-white rounded-[30px] shadow-xl border border-gray-100 overflow-hidden">
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="text-center mt-20 text-gray-400">
            <p className="text-4xl mb-2">🤖</p>
            <p className="text-sm italic">Chào Boss! TripPuddy đã sẵn sàng nghe lệnh.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`p-4 rounded-2xl max-w-[80%] animate-in fade-in slide-in-from-bottom-2 ${
              msg.role === 'user' 
                ? 'bg-[#10b981] text-white rounded-tr-none' 
                : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-none'
            }`}>
              {msg.content}
            </div>

            {/* NÚT LOA BÊN CẠNH TIN NHẮN AI */}
            {msg.role === 'assistant' && (
              <button 
                onClick={() => speak(msg.content)}
                className="mb-1 p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors text-gray-400 hover:text-blue-500"
                title="Nghe câu trả lời"
              >
                🔊
              </button>
            )}
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

      <form onSubmit={sendMessage} className="p-4 bg-white border-t flex items-center gap-3">
        <div className="flex-shrink-0 bg-gray-100 rounded-full p-1 hover:bg-gray-200 transition-colors">
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
      </form>
    </div>
  )
}