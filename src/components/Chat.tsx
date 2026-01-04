'use client'

import { useEffect, useMemo, useRef, useState, FormEvent } from 'react'
import MicButton from './MicButton'
import { getTrips } from '@/lib/storage'

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  language?: string;
};

type StoredLocation = {
  lat: number | null;
  lon: number | null;
  city?: string | null;
  source?: 'gps' | 'ip' | 'none';
  updatedAt?: number;
};

const LOCATION_STORAGE_KEY = 'trippuddy_user_location';
const TITLE_STORAGE_KEY = 'trippuddy_user_title';

const PRESET_TITLES = ['Boss', 'Sir', 'Honey', 'Madam', 'Friend'] as const;

function safeJsonParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // -------- Title (Boss / Sir / Honey / Custom...) --------
  const [userTitle, setUserTitle] = useState<string>('Boss')
  const [customTitleDraft, setCustomTitleDraft] = useState<string>('')

  const titleSelectValue = useMemo(() => {
    if ((PRESET_TITLES as readonly string[]).includes(userTitle)) return userTitle;
    return 'Custom';
  }, [userTitle]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TITLE_STORAGE_KEY) : null;
    if (stored && String(stored).trim()) setUserTitle(String(stored).trim());
  }, []);

  function persistTitle(v: string) {
    const val = (v || '').trim() || 'Boss';
    setUserTitle(val);
    try { localStorage.setItem(TITLE_STORAGE_KEY, val); } catch {}
  }

  // -------- Location (GPS first; IP only on-demand) --------
  const [userLocation, setUserLocation] = useState<StoredLocation>({ lat: null, lon: null, city: null, source: 'none' })
  const [locStatus, setLocStatus] = useState<string>('Location: not set')

  useEffect(() => {
    const stored = safeJsonParse(typeof window !== 'undefined' ? localStorage.getItem(LOCATION_STORAGE_KEY) : null) as StoredLocation | null;
    if (stored && isFiniteNumber(stored.lat) && isFiniteNumber(stored.lon)) {
      setUserLocation(stored);
      setLocStatus(`Location: saved${stored.source === 'gps' ? ' (GPS)' : stored.source === 'ip' ? ' (approx)' : ''}${stored.city ? ` (${stored.city})` : ''}`);
    } else {
      setLocStatus('Location: requesting GPS…');
    }
  }, []);

  // Try GPS once on mount. If denied/unavailable, do NOT silently default to some city (e.g., Adelaide).
  useEffect(() => {
    let cancelled = false;

    function tryGPS() {
      if (!navigator?.geolocation) {
        setLocStatus('Location: geolocation unavailable in this browser');
        return;
      }

      // If we already have GPS coords, don't re-run.
      if (isFiniteNumber(userLocation.lat) && isFiniteNumber(userLocation.lon) && userLocation.source === 'gps') {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const next: StoredLocation = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            city: null,
            source: 'gps',
            updatedAt: Date.now(),
          };
          setUserLocation(next);
          setLocStatus('Location: GPS');
          try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next)); } catch {}
        },
        (err) => {
          if (cancelled) return;
          // Do not auto-fallback to IP; it is often wrong and causes "Adelaide" symptoms.
          const next: StoredLocation = { lat: null, lon: null, city: null, source: 'none', updatedAt: Date.now() };
          setUserLocation(next);
          setLocStatus(
            err?.code === 1
              ? 'Location: permission denied (enable location to get nearby results)'
              : 'Location: unavailable (enable location to get nearby results)'
          );
          try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next)); } catch {}
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10_000 }
      );
    }

    tryGPS();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function detectLocationViaIP() {
    setLocStatus('Location: detecting (approx)…');
    try {
      const res = await fetch('https://ipapi.co/json/');
      const json = await res.json();
      const lat = typeof json?.latitude === 'number' ? json.latitude : null;
      const lon = typeof json?.longitude === 'number' ? json.longitude : null;
      const city = (json?.city ?? null) as string | null;

      const next: StoredLocation = {
        lat,
        lon,
        city,
        source: 'ip',
        updatedAt: Date.now(),
      };

      setUserLocation(next);
      setLocStatus(`Location: approx${city ? ` (${city})` : ''}`);
      try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next)); } catch {}
    } catch {
      setLocStatus('Location: approx lookup failed');
    }
  }

  function clearSavedLocation() {
    const next: StoredLocation = { lat: null, lon: null, city: null, source: 'none', updatedAt: Date.now() };
    setUserLocation(next);
    setLocStatus('Location: cleared');
    try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  // Scroll to bottom automatically
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Load saved trips
  useEffect(() => {
    const stored = getTrips?.()
    if (stored) setSavedTrips(stored)
  }, [])

  // Backend handles accurate detection; keep this simple
  function detectLanguageFallback(_text: string): string {
    return "en"
  }

  async function sendMessage(e?: FormEvent, voiceText?: string) {
    if (e) e.preventDefault()

    const text = (voiceText || input || '').trim()
    if (!text) return

    const lang = detectLanguageFallback(text)
    const userMsg: Message = { role: 'user', content: text, language: lang }
    const history = [...messages, userMsg]

    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const hasCoords = isFiniteNumber(userLocation.lat) && isFiniteNumber(userLocation.lon);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          userTitle,
          // Only send location if we truly have it. Avoids wrong-city behavior.
          userLocation: hasCoords ? { lat: userLocation.lat, lon: userLocation.lon, city: userLocation.city ?? null, source: userLocation.source } : null,
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
      {/* Header / controls */}
      <div className="chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 900 }}>TripPuddy Chat Guide 💬</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>How should I call you?</div>
          <select
            value={titleSelectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'Custom') {
                setCustomTitleDraft((PRESET_TITLES as readonly string[]).includes(userTitle) ? '' : userTitle);
              } else {
                persistTitle(v);
              }
            }}
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white' }}
          >
            {PRESET_TITLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value="Custom">Custom…</option>
          </select>
        </div>
      </div>

      {titleSelectValue === 'Custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={customTitleDraft}
            onChange={(e) => setCustomTitleDraft(e.target.value)}
            placeholder="Enter custom title (e.g., Captain, Queen, Tho)"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid #cbd5e1' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                persistTitle(customTitleDraft);
              }
            }}
          />
          <button
            type="button"
            onClick={() => persistTitle(customTitleDraft)}
            style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: '#0ea5a4', color: 'white', fontWeight: 900, cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      )}

      {/* Location status + controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, fontSize: 14, opacity: 0.9 }}>
        <div>{locStatus}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              if (!navigator?.geolocation) return;
              setLocStatus('Location: requesting GPS…');
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const next: StoredLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude, city: null, source: 'gps', updatedAt: Date.now() };
                  setUserLocation(next);
                  setLocStatus('Location: GPS');
                  try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next)); } catch {}
                },
                () => setLocStatus('Location: permission denied (enable location to get nearby results)'),
                { enableHighAccuracy: true, timeout: 6000, maximumAge: 10_000 }
              );
            }}
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
          >
            Retry GPS
          </button>

          <button
            type="button"
            onClick={detectLocationViaIP}
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
            title="Approximate location via IP (can be inaccurate)"
          >
            Use approx
          </button>

          <button
            type="button"
            onClick={clearSavedLocation}
            style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      </div>

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
