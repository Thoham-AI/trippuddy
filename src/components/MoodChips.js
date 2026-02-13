'use client'

import { useState } from 'react'

type Mood = 'relax' | 'explore' | 'escape'

interface MoodChipsProps {
  onSelect?: (mood: Mood) => void
}

export default function MoodChips({ onSelect }: MoodChipsProps) {
  const moods: { id: Mood; label: string }[] = [
    { id: 'relax', label: 'Relax 😌' },
    { id: 'explore', label: 'Explore 🧭' },
    { id: 'escape', label: 'Escape 🌴' },
  ]

  const [selected, setSelected] = useState<Mood | null>(null)

  return (
    <div className="flex flex-wrap gap-3 justify-center mt-6">
      {moods.map((m) => (
        <button
          key={m.id}
          onClick={() => {
            setSelected(m.id)
            onSelect?.(m.id)
          }}
          className={`px-5 py-2 rounded-full border transition ${
            selected === m.id
              ? 'bg-teal-500 text-white border-teal-500'
              : 'border-gray-300 text-gray-700 hover:border-teal-400'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
