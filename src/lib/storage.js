// src/lib/storage.js

export function saveTrip(trip) {
  if (typeof window === 'undefined') return;
  const trips = JSON.parse(localStorage.getItem('tripPuddyTrips') || '[]');
  trips.push(trip);
  localStorage.setItem('tripPuddyTrips', JSON.stringify(trips));
}

export function getTrips() {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('tripPuddyTrips') || '[]');
}