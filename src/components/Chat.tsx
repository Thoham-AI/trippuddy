'use client'

import { useState, useEffect, FormEvent } from 'react'
import TripCard from './TripCard'
import { saveTrip, getTrips } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'

type Message = { role: 'user' | 'assistant'; content: string }
type Destination = { name: string; country?: string; reason?: string; image?: string }

export default function Chat() {
  const [ready, setReady] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [savedTrips, setSavedTrips] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    console.log('✅ Chat mounted')
    setReady(true)
    try {
      const stored = getTrips?.()
      console.log('🧳 Stored trips:', stored)
      if (stored) setSavedTrips(stored)
    } catch (err) {
      console.error('⚠️ Error loading saved trips:', err)
      setError('Could not load saved trips.')
    }
  }, [])

  async function sendMessage(e: FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setError(null)
    setLoading(true)
    setSaved(false)

    // 🔥 FIXED SECTION — TypeScript safe
const newMessages: Message[] = [
  ...messages,
  { role: 'user', content: input } as Message,
]
    const newMessages: Message[] = [...messages, newMessage]

    setMessages(newMessages)
    setInput('')

    try {
      console.log('➡️ Sending to /api/chat ...')
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          preferences: { mood: 'relax', budget: 'mid' },
        }),
      })

      console.log('⬅️ Response:', res.status)
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      console.log('📦 Chat data:', data)

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || 'Let’s plan something amazing ✈️',
      }

      setMessages([...newMessages, assistantMessage])
      setDestinations(Array.isArray(data.destinations) ? data.destinations : [])
    } catch (err: any) {
      console.error('❌ Chat error:', err)
      setError('Failed to fetch response from /api/chat.')

      const assistantError: Message = {
        role: 'assistant',
        content: '⚠️ Sorry, something went wrong. Try again later.',
      }

      setMessages([...newMessages, assistantError])
    } finally {
      setLoading(false)
    }
  }

  function handleSaveTrip() {
    try {
      if (!destinations.length) return
      const newTrip = {
        id: uuidv4(),
        destination: destinations[0].name || 'Unnamed trip',
        summary: messages[messages.length - 1]?.content || '',
        plan: [
          { day: 1, am: 'Arrival & explore', pm: 'Lunch & rest', eve: 'Night stroll' },
          { day: 2, am: 'Main attraction', pm: 'Cafe or museum', eve: 'Dinner' },
          { day: 3, am: 'Relax & shopping', pm: 'Local market', eve: 'Return home' },
        ],
      }
      console.log('💾 Saving trip:', newTrip)
      saveTrip?.(newTrip)
      setSavedTrips((prev) => [...prev, newTrip])
      setSaved(true)
    } catch (err) {
      console.error('❌ Save trip error:', err)
      setError('Unable to save this trip.')
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700">
        ⏳ Loading Chat component...
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50">
      {/* Status bar */}
      <div className="w-full bg-yellow-100 text-gray-800 text-sm text-center py-2 border-b border-yellow-300">
        ✅ Chat ready — {loading ? '🤔 Thinking...' : 'Idle'} {error && `| ⚠️ ${error}`}
      </div>

      {/* Main area */}
      <div className="w-full max-w-4xl flex flex-col bg-white shadow-sm rounded-xl mt-6 mb-6 border border-gray-200">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 italic">
              🗨️ Start chatting with TripPuddy below!
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-2xl max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-teal-100 self-end text-gray-900'
                  : 'bg-gray-100 self-start text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          ))}

          {loading && <div className="text-gray-400 italic animate-pulse">TripPuddy is thinking...</div>}

          {destinations.length > 0 && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-center">
              {destinations.map((d, i) => (
                <TripCard key={i} destination={d} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex flex-col gap-2 bg-gray-50 rounded-b-xl">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              placeholder="Ask TripPuddy about your next trip..."
              className="flex-1 border rounded-xl px-3 py-2 outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-teal-500 text-white px-4 py-2 rounded-xl hover:bg-teal-600 disabled:opacity-50"
            >
              {loading ? 'Thinking...' : 'Send'}
            </button>
          </form>

          {destinations.length > 0 && (
            <button
              onClick={handleSaveTrip}
              className="bg-gray-100 text-gray-800 py-2 px-4 rounded-xl hover:bg-teal-50 border border-gray-200 transition"
            >
              {saved ? '✅ Trip saved!' : '💾 Save this trip'}
            </button>
          )}
        </div>
      </div>

      {/* Saved trips */}
      {savedTrips.length > 0 && (
        <div className="w-full max-w-4xl bg-white shadow-sm rounded-xl border border-gray-200 mb-8 p-4">
          <h2 className="text-xl font-bold mb-3 text-gray-900">My Saved Trips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedTrips.map((trip) => (
              <div key={trip.id} className="border rounded-xl p-3 shadow-sm bg-gray-50">
                <h3 className="font-semibold text-teal-800">{trip.destination}</h3>
                <p className="text-sm text-gray-600">{trip.summary.slice(0, 100)}...</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
