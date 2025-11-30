import { NextResponse } from "next/server";
import OpenAI from "openai";

// Google Places Photo Lookup (final version)
async function fetchGooglePlacePhoto(title, apiKey) {
  try {
    const searchUrl =
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(title)}&key=${apiKey}`;

    const res = await fetch(searchUrl);
    const json = await res.json();

    const place = json.results?.[0];
    if (!place) return null;

    const photo = place.photos?.[0];
    if (!photo) return null;

    return photo.photo_reference;
  } catch (err) {
    console.error("Google Places search failed:", err);
    return null;
  }
}

// OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Weather lookup
async function getWeather(lat, lon) {
  try {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return null;

    const url =
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error("Weather error:", err);
    return null;
  }
}

// Fallback image (GPT-generated)
async function generateImage(prompt) {
  try {
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: `Travel destination photo: ${prompt}`,
      size: "1024x1024",
    });

    return result.data[0].url;
  } catch (err) {
    console.error("Image generation error:", err);
    return null;
  }
}

export async function POST(req) {
  console.log("---- API HIT ----");

  try {
    const bodyText = await req.text();
    const data = JSON.parse(bodyText || "{}");

    console.log("Parsed Body:", data);

    const userPrompt = data.userPrompt || "1 day itinerary";
    const userLocation = data.userLocation || null;

    // Weather
    let weather = null;
    if (userLocation?.lat && userLocation?.lon) {
      weather = await getWeather(userLocation.lat, userLocation.lon);
    }

    // Ask GPT for itinerary
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert travel planner. Output JSON only.",
        },
        {
          role: "user",
          content: `
Generate a detailed JSON itinerary for: "${userPrompt}".

Include for each activity:
- time of day
- title
- description
- estimated cost
- Google Maps search query
- latitude & longitude (guess if needed)

Weather: ${weather ? JSON.stringify(weather) : "unknown"}
        `,
        },
      ],
      temperature: 0.4,
    });

    let itineraryJSON = completion.choices[0].message.content || "{}";

    let itinerary;
    try {
      itinerary = JSON.parse(itineraryJSON);
    } catch {
      itinerary = JSON.parse(
        itineraryJSON.replace(/```json|```/g, "").trim()
      );
    }

    // -------------------------------
    // ⭐ NORMALIZE GPT STRUCTURE HERE
    // -------------------------------
    // GPT returns: itinerary.itinerary.activities
    if (!itinerary.days && itinerary.itinerary?.activities) {
      itinerary.days = [
        {
          day: 1,
          activities: itinerary.itinerary.activities.map((a) => ({
            title: a.title,
            time_of_day: a.time_of_day,
            description: a.description,
            estimated_cost: a.estimated_cost,
            google_maps_query: a.google_maps_query || a.google_maps_search_query,
            latitude: a.latitude,
            longitude: a.longitude,
          })),
        },
      ];
    }

    // ------------------------------------
    // ⭐ ADD GOOGLE PLACE PHOTOS
    // ------------------------------------
    const googleKey = process.env.GOOGLE_PLACES_API_KEY;

    for (const day of itinerary.days || []) {
      for (const act of day.activities || []) {
        let photoRef = null;

        if (googleKey && act.title) {
          try {
            photoRef = await fetchGooglePlacePhoto(act.title, googleKey);
          } catch (err) {
            console.error("Google Places error:", err);
          }
        }

        if (photoRef) {
          act.image =
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${googleKey}`;
        } else {
          act.image = await generateImage(act.title);
        }
      }
    }

    // -------------------------------
    // Log output
    // -------------------------------
    console.log(
      "FULL API RESPONSE:",
      JSON.stringify({ itinerary, weather, userLocation }, null, 2)
    );

    return NextResponse.json(
      {
        ok: true,
        itinerary,
        weather,
        userLocation,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Itinerary generation failed",
        details: String(err),
      },
      { status: 500 }
    );
  }
}
