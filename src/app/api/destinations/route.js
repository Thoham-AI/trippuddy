import OpenAI from "openai";

export async function POST(req) {
  const { prompt } = await req.json();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
            You are a travel planner AI.
            Always respond ONLY with a valid JSON object following EXACTLY this schema:

            {
              "destinations": [
                { "name": "string", "image": "string", "description": "string" }
              ],
              "itinerary": [
                { "day": number, "plan": ["string", "string", "string"] }
              ]
            }

            - Do NOT add extra fields like "destination" or "duration".
            - Do NOT use keys like "day_1", "day_2".
            - Do NOT add explanations.
          `,
        },
        {
          role: "user",
          content: `Create a 3-day travel itinerary for: ${prompt}`,
        },
      ],
      temperature: 0.7,
    });

    let data;
    try {
      data = JSON.parse(completion.choices[0].message.content);
    } catch {
      data = { destinations: [], itinerary: [] }; // fallback
    }

    // validate & fix if wrong
    data = validateSchema(data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("API error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch itinerary" }),
      { status: 500 }
    );
  }
}

// --- Schema validator ---
function validateSchema(raw) {
  const fixed = { destinations: [], itinerary: [] };

  // Destinations
  if (Array.isArray(raw.destinations)) {
    fixed.destinations = raw.destinations.map((d) => ({
      name: d.name || "Unknown",
      image: d.image || "/fallback.jpg",
      description: d.description || "",
    }));
  }

  // Itinerary
  if (Array.isArray(raw.itinerary)) {
    fixed.itinerary = raw.itinerary.map((day, i) => ({
      day: typeof day.day === "number" ? day.day : i + 1,
      plan: Array.isArray(day.plan)
        ? day.plan
        : Object.values(day.activities || {}).map((a) => a.description),
    }));
  } else if (raw.itinerary && typeof raw.itinerary === "object") {
    // case AI trả { day_1: {...}, day_2: {...} }
    fixed.itinerary = Object.keys(raw.itinerary).map((k, i) => ({
      day: i + 1,
      plan: (raw.itinerary[k].activities || []).map((a) => a.description),
    }));
  }

  return fixed;
}
