'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import MicButton from './MicButton'
import { getTrips } from '@/lib/storage'

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    const stored = getTrips?.()
    if (stored) setSavedTrips(stored)
  }, [])

  async function sendMessage(e: FormEvent, voice?: string) {
    e.preventDefault()

    const text = voice || input
    if (!text.trim()) return

    const userMsg: Message = { role: 'user', content: text }
    const history = [...messages, userMsg]

    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      })

      const data = await res.json()

      const bot: Message = {
        role: 'assistant',
        content: data.reply || "I'm here to help you explore the world! 🌍"
      }

      setMessages([...history, bot])
    } catch {
      setMessages([...history, { role: 'assistant', content: "⚠️ Something went wrong." }])
    } finally {
      setLoading(false)
    }
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

      <form className="chat-input" onSubmit={sendMessage}>
        <MicButton onSpeech={(t) => sendMessage(new Event("submit") as any, t)} />

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask TripPuddy anything…"
        />

        <button type="submit" className="send-btn">Send</button>
      </form>

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
