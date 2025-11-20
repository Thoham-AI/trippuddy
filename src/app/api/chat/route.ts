import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { message, salutation = "friend", location } = await req.json();

    // Intent check (very simple first version)
    const wantsFood =
      /supper|dinner|light supper|eat|food|restaurant/i.test(message);

    // If user wants food AND we have location → suggest places
    if (wantsFood && location?.lat && location?.lon) {
      const lat = location.lat;
      const lon = location.lon;

      // Free OpenStreetMap search for restaurants nearby
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&amenity=restaurant&extratags=1&addressdetails=1&bounded=1&viewbox=${lon-0.01},${lat+0.01},${lon+0.01},${lat-0.01}`;

      const res = await fetch(url, {
        headers: { "User-Agent": "TripPuddy/1.0" },
      });
      const places = await res.json();

      if (places.length > 0) {
        const options = places
          .map((p) => {
            const name = p.display_name.split(",")[0];
            const dist = haversine(lat, lon, parseFloat(p.lat), parseFloat(p.lon));

            return `🍽️ **${name}**  
• ${dist.toFixed(1)} km away  
• Category: Restaurant`;
          })
          .join("\n\n");

        return NextResponse.json({
          reply: `Sure, ${salutation}! I found a few light-supper options near you:\n\n${options}\n\nWould you like directions or a recommendation?`,
        });
      }
    }

    // Otherwise fallback to your normal AI chat
    return NextResponse.json({
      reply:
        "I can help you with that! (Food suggestions work best when location access is enabled.)",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ reply: "Something went wrong." });
  }
}

// Simple distance function
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}
