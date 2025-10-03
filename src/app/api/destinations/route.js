import OpenAI from "openai";

export async function POST(req) {
  try {
    const { prompt } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional travel planner AI.
Always respond ONLY with valid JSON in this schema:

{
  "destinations": [
    { "name": "string", "country": "string", "description": "string", "image": "string" }
  ],
  "itinerary": [
    {
      "day": number,
      "date": "string (Day 1, Day 2, ...)",
      "activities": [
        {
          "time": "string (e.g. 09:00 - 11:00)",
          "title": "string (activity name)",
          "location": "string (place name)",
          "details": "string (short description, what to expect, tips)",
          "cost_estimate": "string (approx price in USD or local currency)",
          "link": "string (Google Maps or official website if available)"
        }
      ]
    }
  ]
}

Rules:
- 3–6 activities per day with clear time slots.
- Include food or cultural experiences as activities.
- Use internationally recognized names in English.
- Do not include explanations outside JSON.
`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    // Parse AI JSON safely
    const rawText = response.choices[0].message.content.trim();
    const data = JSON.parse(rawText);

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to generate itinerary" }), { status: 500 });
  }
}
