'use client'

import { useEffect, useState } from 'react'

export type ItineraryItem = {
  day: number
  am: string
  pm: string
  eve: string
}

export type Itinerary = {
  id: string
  destination: string
  summar
