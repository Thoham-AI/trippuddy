"use client";

import { useRouter } from 'next/navigation'
import MoodChips from '@/components/MoodChips'

export default function HomePage() {
  const router = useRouter()

  function handleSelect(mood) {
    localStorage.setItem('tripPuddyMood', mood)
    router.push('/chat')
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[url('/images/travel-bg.jpg')] bg-cover bg-center text-white">
      <div className="bg-black/50 p-8 rounded-2xl text-center">
        <h1 className="text-3xl font-bold mb-3">What kind of break do you need?</h1>
        <MoodChips onSelect={handleSelect} />
      </div>
    </div>
  )
}