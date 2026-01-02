'use client'

import { useEffect, useRef, useState } from 'react'

type Destination = {
  name: string
  country?: string
  reason?: string
  image?: string
}

export default function TripCard({ destination }: { destination: Destination }) {
  const FALLBACK = '/fallback.jpg'

  // IMPORTANT: initialize from props, but also keep it in sync when destination changes
  const [imageUrl, setImageUrl] = useState(destination?.image || FALLBACK)
  const [loading, setLoading] = useState(!destination?.image)

  // Prevent stale async responses from overwriting the latest destination’s image
  const requestSeq = useRef(0)

  useEffect(() => {
    if (!destination) return

    // Always reset state when destination changes (fixes "previous image sticks")
    if (destination.image) {
      setImageUrl(destination.image)
      setLoading(false)
      return
    } else {
      setImageUrl(FALLBACK)
      setLoading(true)
    }

    const seq = ++requestSeq.current
    const controller = new AbortController()

    async function fetchImage() {
      try {
        const query = encodeURIComponent(destination.name || 'travel destination')
        const res = await fetch(`/api/images?q=${query}&limit=1`, {
          signal: controller.signal,
        })
        const data = await res.json()

        // If another request started after this one, ignore this response
        if (seq !== requestSeq.current) return

        const url = data?.images?.[0]?.url
        setImageUrl(url || FALLBACK)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('Image fetch error:', err)
        if (seq !== requestSeq.current) return
        setImageUrl(FALLBACK)
      } finally {
        if (seq !== requestSeq.current) return
        setLoading(false)
      }
    }

    fetchImage()

    // Abort when destination changes/unmounts
    return () => controller.abort()
  }, [destination?.name, destination?.image])

  if (!destination) return null

  return (
    <div
      className="rounded-2xl shadow hover:shadow-lg transition overflow-hidden bg-white border border-gray-100"
      style={{
        width: '100%',
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Image Section */}
      <div
        style={{
          width: '100%',
          height: '200px',
          overflow: 'hidden',
          position: 'relative',
          borderBottom: '1px solid #eee',
        }}
      >
        {loading ? (
          <div
            className="animate-pulse bg-gray-200"
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        ) : (
          <img
            src={imageUrl}
            alt={destination.name || 'Destination'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
            onError={(e) => (e.currentTarget.src = FALLBACK)}
          />
        )}
      </div>

      {/* Text Section */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <h3 className="font-semibold text-lg text-gray-900 mb-1">
            {destination.name || 'Unknown Destination'}
          </h3>

          <p className="text-sm text-gray-600 leading-snug">
            {destination.reason || 'A wonderful place to explore and enjoy.'}
          </p>
        </div>

        {destination.country && (
          <p className="text-xs text-gray-500 mt-2">
            📍 {destination.country}
          </p>
        )}
      </div>
    </div>
  )
}
