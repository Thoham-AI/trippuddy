import OpenAI from "openai";

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey: key });
}

export default async function handlePackingList(itinerary) {
  try {
    if (!itinerary || typeof itinerary !== "object") {
      return { ok: false, text: "Missing or invalid itinerary." };
    }

    const client = getClient();

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are TripPuddy, an expert travel assistant.
Given an itinerary JSON, produce a concise packing list…`
        },
        { role: "user", content: JSON.stringify(itinerary) }
      ],
      temperature: 0.7,
      max_tokens: 600
    });

    return { ok: true, text: res.choices[0]?.message?.content || "" };
  } catch (err) {
    return { ok: false, text: "Packing list generation failed.", details: String(err) };
  }
}
