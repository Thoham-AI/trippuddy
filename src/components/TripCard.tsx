'use client'

import { useEffect, useState } from 'react'

type Destination = {
  name: string
  country?: string
  reason?: string
  image?: string
}

export default function TripCard({ destination }: { destination: Destination }) {
  const [imageUrl, setImageUrl] = useState(destination.image || '/fallback.jpg')
  const [loading, setLoading] = useState(!destination.image)

  useEffect(() => {
    if (destination.image) return

    async function fetchImage() {
      try {
        const query = encodeURIComponent(destination.name || 'travel destination')
        const res = await fetch(`/api/images?q=${query}&limit=1`)
        const data = await res.json()

        if (data?.images?.[0]?.url) {
          setImageUrl(data.images[0].url)
        } else {
          setImageUrl('/fallback.jpg')
        }
      } catch (err) {
        console.error('Image fetch error:', err)
        setImageUrl('/fallback.jpg')
      } finally {
        setLoading(false)
      }
    }

    fetchImage()
  }, [destination.name, destination.image])

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
            onError={(e) => (e.currentTarget.src = '/fallback.jpg')}
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
