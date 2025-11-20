import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  const { prompt, userLocation } = await req.json();

  const systemPrompt = `
You are TripPuddy AI, an expert travel planner.
Generate a JSON itinerary array for 1–5 days based on the user’s request.
Each day should have:
- day number
- list of activities (3–6 per day)
Each activity must include:
{
  "time": "09:00 AM",
  "title": "Visit Gardens by the Bay",
  "details": "Explore the iconic Supertree Grove and Cloud Forest.",
  "location": {
    "name": "Gardens by the Bay",
    "city": "Singapore",
    "country": "SG",
    "link": "https://goo.gl/maps/123"
  },
  "coordinates": { "lat": 1.2816, "lon": 103.8636 },
  "image": "",
  "weather": { "temp": 28, "description": "light rain", "link": "" },
  "cost_estimate": "$20",
  "travelTime": null
}
Return pure JSON under key "itinerary".
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const jsonText = completion.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error("Bad JSON:", e, jsonText);
    return new Response(JSON.stringify({ itinerary: [] }), { status: 200 });
  }

  return new Response(JSON.stringify(parsed), {
    headers: { "Content-Type": "application/json" },
  });
}
