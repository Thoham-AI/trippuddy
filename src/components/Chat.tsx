'use client'

import { useEffect, useMemo, useRef, useState, FormEvent } from 'react'
import MicButton from './MicButton'
import { getTrips } from '@/lib/storage'
import { supabase } from '@/lib/supabase' // Đảm bảo bạn đã tạo file này trong src/lib

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
  try { return JSON.parse(raw); } catch { return null; }
}

function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const [user, setUser] = useState<any>(null) // Quản lý user
  const [lastItinerary, setLastItinerary] = useState<any>(null) // Lưu itinerary tạm thời để chờ Save
  const bottomRef = useRef<HTMLDivElement>(null)

  // -------- Auth Logic (MỚI) --------
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])


  // -------- Database Logic (MỚI) --------
  const saveToCloud = async () => {
    if (!user) return alert("Vui lòng đăng nhập để lưu!")
    if (!lastItinerary) return

    setLoading(true)
    const { error } = await supabase.from('itineraries').insert({
      user_id: user.id,
      destination: lastItinerary.destination || 'New Trip',
      details: lastItinerary
    })

    if (error) alert("Lỗi: " + error.message)
    else {
      alert("Đã lưu thành công! 💾")
      setLastItinerary(null)
    }
    setLoading(false)
  }

  // -------- Title & Location (GIỮ NGUYÊN) --------
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

  const [userLocation, setUserLocation] = useState<StoredLocation>({ lat: null, lon: null, city: null, source: 'none' })
  const [locStatus, setLocStatus] = useState<string>('Location: not set')

  useEffect(() => {
    const stored = safeJsonParse(typeof window !== 'undefined' ? localStorage.getItem(LOCATION_STORAGE_KEY) : null) as StoredLocation | null;
    if (stored && isFiniteNumber(stored.lat) && isFiniteNumber(stored.lon)) {
      setUserLocation(stored);
      setLocStatus(`Location: saved (${stored.source})`);
    } else {
      setLocStatus('Location: requesting GPS…');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    function tryGPS() {
      if (!navigator?.geolocation) { setLocStatus('Location: unavailable'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const next: StoredLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude, city: null, source: 'gps', updatedAt: Date.now() };
          setUserLocation(next); setLocStatus('Location: GPS');
          try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next)); } catch {}
        },
        (err) => { if (!cancelled) setLocStatus('Location: denied/unavailable'); },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
    tryGPS();
    return () => { cancelled = true; };
  }, []);

  async function detectLocationViaIP() {
    setLocStatus('Location: detecting (approx)…');
    try {
      const res = await fetch('https://ipapi.co/json/');
      const json = await res.json();
      const next: StoredLocation = { lat: json.latitude, lon: json.longitude, city: json.city, source: 'ip', updatedAt: Date.now() };
      setUserLocation(next); setLocStatus(`Location: approx (${json.city})`);
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
    } catch { setLocStatus('Location: approx lookup failed'); }
  }

  function clearSavedLocation() {
    const next: StoredLocation = { lat: null, lon: null, city: null, source: 'none' };
    setUserLocation(next); setLocStatus('Location: cleared');
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    const stored = getTrips?.()
    if (stored) setSavedTrips(stored)
  }, [])

  // -------- Message Logic (CẬP NHẬT) --------
  async function sendMessage(e?: FormEvent, voiceText?: string) {
    if (e) e.preventDefault()
    const text = (voiceText || input || '').trim()
    if (!text) return

    const userMsg: Message = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history); setInput(''); setLoading(true); setLastItinerary(null);

    try {
      const isTrip = /trip|plan|itinerary|lịch trình|đi chơi|du lịch/i.test(text);
      const endpoint = isTrip ? '/api/itineraries' : '/api/chat';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: text,
          messages: history,
          userTitle,
          userLocation: isFiniteNumber(userLocation.lat) ? userLocation : null,
        })
      });

      const data = await res.json()
      if (isTrip && data.ok && data.itinerary) {
        setLastItinerary(data.itinerary);
      }

      setMessages([...history, { role: 'assistant', content: data.reply || "Done!" }])
    } catch (err) {
      setMessages([...history, { role: 'assistant', content: "⚠️ Error." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-wrapper">
      {/* AUTH BAR (MỚI) */}

      <div className="chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 900 }}>TripPuddy Chat 💬</div>
        <select value={titleSelectValue} onChange={(e) => e.target.value !== 'Custom' && persistTitle(e.target.value)} style={{ padding: '6px', borderRadius: 10 }}>
          {PRESET_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
          <option value="Custom">Custom…</option>
        </select>
      </div>

      {titleSelectValue === 'Custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={customTitleDraft} onChange={(e) => setCustomTitleDraft(e.target.value)} placeholder="Custom title..." style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid #cbd5e1' }} />
          <button onClick={() => persistTitle(customTitleDraft)} style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: '#0ea5a4', color: 'white' }}>Save</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
        <div>{locStatus}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.location.reload()} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1', cursor: 'pointer' }}>Retry GPS</button>
          <button onClick={detectLocationViaIP} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1', cursor: 'pointer' }}>Use approx</button>
          <button onClick={clearSavedLocation} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #cbd5e1', cursor: 'pointer' }}>Clear</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.role}`}>{msg.content}</div>
        ))}

        {/* NÚT LƯU LỊCH TRÌNH (MỚI) */}
        {lastItinerary && (
          <div style={{ textAlign: 'center', margin: '10px 0' }}>
            <button 
              onClick={saveToCloud}
              style={{ padding: '10px 20px', borderRadius: 20, background: '#f59e0b', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
            >
              {user ? "💾 Save to My Account" : "🔒 Login to Save"}
            </button>
          </div>
        )}

        {loading && <div className="typing-indicator"><span></span><span></span><span></span></div>}
        <div ref={bottomRef}></div>
      </div>

      <form className="chat-input" onSubmit={sendMessage}>
        <MicButton onResult={(t) => sendMessage(undefined, t)} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask TripPuddy anything…" />
        <button type="submit" className="send-btn">Send</button>
      </form>

      {savedTrips.length > 0 && (
        <div className="saved-section">
          <h2>📌 My Saved Trips</h2>
          {savedTrips.map((t: any) => (
            <div key={t.id} className="saved-card">
              <h3>{t.destination}</h3>
              <p>{t.summary?.slice(0, 150)}…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}