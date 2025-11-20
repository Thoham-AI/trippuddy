// Local storage utility for TripPuddy MVP
// Handles saving, loading, and deleting itineraries

export type ItineraryItem = {
  day: number
  am: string
  pm: string
  eve: string
}

export type Itinerary = {
  id: string
  destination: string
  summary: string
  plan: ItineraryItem[]
}

const STORAGE_KEY = 'trippuddy:savedTrips'

// ✅ Get all saved trips
export function getTrips(): Itinerary[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (err) {
    console.error('Error reading localStorage:', err)
    return []
  }
}

// ✅ Save a new trip
export function saveTrip(trip: Itinerary) {
  if (typeof window === 'undefined') return
  try {
    const trips = getTrips()
    const exists = trips.find((t) => t.id === trip.id)
    if (!exists) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([trip, ...trips]))
    }
  } catch (err) {
    console.error('Error saving trip:', err)
  }
}

// ✅ Remove a trip by ID
export function deleteTrip(id: string) {
  if (typeof window === 'undefined') return
  try {
    const trips = getTrips().filter((t) => t.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips))
  } catch (err) {
    console.error('Error deleting trip:', err)
  }
}

// ✅ Get one trip by ID
export function getTripById(id: string): Itinerary | undefined {
  return getTrips().find((t) => t.id === id)
}
