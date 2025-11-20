const BASE = process.env.UNSPLASH_BASE!
const KEY = process.env.UNSPLASH_ACCESS_KEY!

type Mood = 'relax' | 'explore' | 'escape'

export async function getDestinationImage(
  name: string,
  mood: Mood = 'explore'
): Promise<string | null> {
  // Map moods to visual keywords
  const moodKeywords: Record<Mood, string[]> = {
    relax: ['beach', 'spa', 'ocean', 'resort', 'sunset'],
    explore: ['mountain', 'city skyline', 'nature trail', 'culture', 'architecture'],
    escape: ['remote island', 'hidden village', 'forest', 'countryside', 'retreat'],
  }

  // Pick 1–2 random keywords from mood category
  const extra =
    moodKeywords[mood][Math.floor(Math.random() * moodKeywords[mood].length)]

  const query = `${name} ${extra}`

  try {
    const res = await fetch(
      `${BASE}/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1`,
      {
        headers: { Authorization: `Client-ID ${KEY}` },
        cache: 'no-store',
      }
    )

    if (!res.ok) return null
    const data = await res.json()
    return data.results?.[0]?.urls?.regular || null
  } catch (err) {
    console.error('Unsplash smart fetch error:', err)
    return null
  }
}
