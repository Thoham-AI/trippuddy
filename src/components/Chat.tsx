'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import MicButton from './MicButton'
import { getTrips } from '@/lib/storage'

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  language?: string;
};

type UserLocation = { lat: number | null; lon: number | null; city?: string | null };

const LOCATION_STORAGE_KEY = 'trippuddy_user_location';
const TITLE_STORAGE_KEY = 'trippuddy_user_title';

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const [userLocation, setUserLocation] = useState<UserLocation>({ lat: null, lon: null, city: null })
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

  // Load location from localStorage (if homepage already saved it)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.lat === 'number' && typeof parsed?.lon === 'number') {
          setUserLocation({ lat: parsed.lat, lon: parsed.lon, city: parsed.city ?? null })
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Detect location (GPS -> IP -> fallback) and persist for other pages
  useEffect(() => {
    let cancelled = false

    async function detectLocation() {
      // If we already have valid coords, don't re-run.
      if (typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number') return

      // 1) Browser GPS
      try {
        if (navigator?.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return
              const lat = pos.coords.latitude
              const lon = pos.coords.longitude
              const next = { lat, lon, city: null }
              setUserLocation(next)
              try {
                localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
              } catch {}
            },
            async () => {
              // 2) IP fallback
              try {
                const res = await fetch("https://ipapi.co/json/")
                const json = await res.json()
                const lat = typeof json?.latitude === 'number' ? json.latitude : null
                const lon = typeof json?.longitude === 'number' ? json.longitude : null
                const city = (json?.city ?? null) as string | null

                const next = {
                  lat: lat ?? -25.2744,
                  lon: lon ?? 133.7751,
                  city
                }
                if (cancelled) return
                setUserLocation(next)
                try {
                  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
                } catch {}
              } catch {
                // 3) Final fallback
                const next = { lat: -25.2744, lon: 133.7751, city: null }
                if (cancelled) return
                setUserLocation(next)
                try {
                  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
                } catch {}
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 4000,
              maximumAge: 5000,
            }
          )
        } else {
          // No geolocation available
          const next = { lat: -25.2744, lon: 133.7751, city: null }
          if (cancelled) return
          setUserLocation(next)
          try {
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
          } catch {}
        }
      } catch {
        const next = { lat: -25.2744, lon: 133.7751, city: null }
        if (cancelled) return
        setUserLocation(next)
        try {
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
        } catch {}
      }
    }

    detectLocation()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation.lat, userLocation.lon])

  // Backend handles accurate detection; keep this simple
  function detectLanguageFallback(_text: string): string {
    return "en"
  }

  function getUserTitle(): string {
    try {
      const t = localStorage.getItem(TITLE_STORAGE_KEY)
      return (t && String(t).trim()) ? String(t).trim() : "Boss"
    } catch {
      return "Boss"
    }
  }

  async function sendMessage(e?: FormEvent, voiceText?: string) {
    if (e) e.preventDefault()

    const text = voiceText || input
    if (!text.trim()) return

    const lang = detectLanguageFallback(text)
    const userMsg: Message = { role: 'user', content: text, language: lang }
    const history = [...messages, userMsg]

    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const { lat, lon, city } = userLocation || { lat: null, lon: null, city: null }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          userTitle: getUserTitle(),
          userLocation: { lat, lon, city }
        })
      })

      const data = await res.json()

      const bot: Message = {
        role: 'assistant',
        content: data.reply,
        language: data.language || lang
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
