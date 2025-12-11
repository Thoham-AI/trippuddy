'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import MicButton from './MicButton'
import { getTrips } from '@/lib/storage'

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  language?: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom automatically
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Load saved trips
  useEffect(() => {
    const stored = getTrips?.()
    if (stored) setSavedTrips(stored)
  }, [])

  // ❗ Removed weak regex detection — now handled by API
  function detectLanguageFallback(text: string): string {
    return "en"
  }

  async function sendMessage(e?: FormEvent, voiceText?: string) {
    if (e) e.preventDefault()

    const text = voiceText || input
    if (!text.trim()) return

    // Temporary local guess → backend does accurate detection
    const lang = detectLanguageFallback(text)

    const userMsg: Message = { role: 'user', content: text, language: lang }
    const history = [...messages, userMsg]

    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history
        })
      })

      const data = await res.json()

      const bot: Message = {
        role: 'assistant',
        content: data.reply,
        language: lang
      }

      setMessages([...history, bot])

    } catch (err) {
      console.error(err)
      setMessages([
        ...history,
        { role: 'assistant', content: "⚠️ Something went wrong.", language: "en" }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Voice handler
  const handleVoiceInput = (transcript: string) => {
    sendMessage(undefined, transcript)
  }

  return (
    <div className="chat-wrapper">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`}>
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        )}

        <div ref={bottomRef}></div>
      </div>

      {/* Input Area */}
      <form className="chat-input" onSubmit={sendMessage}>
        <MicButton onResult={handleVoiceInput} />

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask TripPuddy anything…"
        />

        <button type="submit" className="send-btn">Send</button>
      </form>

      {/* Saved Trips */}
      {savedTrips.length > 0 && (
        <div className="saved-section">
          <h2>📌 My Saved Trips</h2>

          {savedTrips.map((t: any) => (
            <div key={t.id} className="saved-card">
              <h3>{t.destination}</h3>
              <p>{t.summary.slice(0, 150)}…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
