\# TripPuddy – Itinerary Engine \& UI Behaviour Notes



This document captures the current design decisions, fixes, and guarantees for the TripPuddy itinerary system, including backend logic, UI behavior, and known constraints.



---



\## 1. Core Goals



TripPuddy must generate itineraries that are:



\- \*\*Geographically consistent\*\* (no city mixing)

\- \*\*Time-realistic\*\* (respect opening hours)

\- \*\*Context-aware\*\* (user location, seasonality)

\- \*\*Actionable in UI\*\* (working website/map buttons, zoomable images)

\- \*\*Deterministic where correctness matters\*\* (do not rely solely on LLM behavior)



---



\## 2. City \& Location Consistency



\### Rules

\- Extract trip city from user prompt if present (e.g. “1 day in Singapore”).

\- Otherwise, derive city from user’s lat/lon (reverse geocoding).

\- \*\*All activities must be inside the same trip city.\*\*



\### Implementation

\- `extractDestinationHint(userPrompt)`

\- `reverseGeocodeCity(lat, lon)`

\- `tripCity = destinationHint || userCity`

\- `cityMatches(userCity, tripCity)`



\### Result

\- Prevents issues like:

&nbsp; - Breakfast in Brisbane + attractions in Darwin

&nbsp; - Cafés from a different country appearing in the same day



---



\## 3. Breakfast Logic (Beginning of Day)



\### Rules

\- If \*\*user is already in the same city as the trip destination\*\*:

&nbsp; - The \*\*first activity of each day must be breakfast / café\*\*

&nbsp; - Scheduled at \*\*08:00\*\*

\- If user is travelling to another city:

&nbsp; - Breakfast is optional and not forced



\### Deterministic Enforcement

LLMs are not trusted for ordering.



A server-side post-process ensures:

\- Breakfast is moved to the first position

\- Time is forced to `08:00`

\- The former first activity is pushed to `09:30` if needed



Implemented in:

\- `enforceBreakfastFirst(days, requireBreakfast)`



---



\## 4. Real Opening Hours (ALL Places)



\### Rules

\- Every place must be scheduled \*\*only when it is actually open\*\*

\- Applies to:

&nbsp; - Museums

&nbsp; - Attractions

&nbsp; - Cafés

&nbsp; - Markets

&nbsp; - Restaurants

\- No hardcoded exceptions (e.g. not only Mindil Market)



\### Implementation

\- Use \*\*Google Places Details API\*\*

\- Fetch:

&nbsp; - `opening\_hours.periods`

&nbsp; - `utc\_offset\_minutes`

&nbsp; - `business\_status`

\- For each activity:

&nbsp; - Convert suggested `arrival\_time` → minutes

&nbsp; - Check against opening intervals for that weekday

&nbsp; - If closed:

&nbsp;   - Shift to the \*\*next open time\*\*

\- Enforce \*\*monotonic schedule\*\* (no time going backwards)



Implemented in:

\- `normalizeTimesToOpeningHours(days, tripCity)`



\### Result

\- No more:

&nbsp; - Morning night markets

&nbsp; - Breakfast after lunch

&nbsp; - Museums before opening



---



\## 5. Seasonal Closures (Example: Mindil Market)



\### Rule

\- If user did not specify exact dates

\- AND current month indicates seasonal closure

\- THEN replace closed venues with valid alternatives



\### Example

\- Mindil Beach Sunset Market → Darwin Waterfront Precinct (off-season)



This logic remains, but is now \*\*complementary\*\* to opening-hours validation.



---



\## 6. Website / Map Button (Critical Fix)



\### Problem Observed

\- Button worked locally

\- Failed or did nothing on Vercel

\- Sometimes always fell back to Google Maps



\### Root Causes

\- `window.open()` blocked by browser when combined with:

&nbsp; - `preventDefault()`

&nbsp; - drag/drop overlays

&nbsp; - capture handlers

\- Missing or null `website` field from Google Places



\### Final Rules

\- \*\*Always provide a valid URL from backend\*\*

\- Website priority:

&nbsp; 1. Official website (`place.website`)

&nbsp; 2. Google Maps place page (`place.url`)

\- UI uses a \*\*real `<a href>` link\*\*, styled as a button



\### Guarantee

\- Website / Map button always opens something meaningful

\- Never silently fails



---



\## 7. Weather Button



\### Behavior

\- Shows:

&nbsp; - Temperature (°C)

&nbsp; - Condition (rain, cloud, thunder, etc.)

\- Color-coded by condition

\- Clicking opens \*\*OpenWeatherMap\*\* with:

&nbsp; - Correct latitude

&nbsp; - Correct longitude

&nbsp; - Visible location on map



\### URL Pattern



