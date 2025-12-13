import OpenAI from "openai";

export default async function handleTourGuide(data) {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Given this itinerary or location, generate a brief tour-guide style narrative.
Make it friendly, local, helpful, and easy to read.

DATA:
${JSON.stringify(data)}
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a knowledgeable, fun local tour guide." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return { ok: true, text: res.choices[0]?.message?.content || "" };
    
  } catch (err) {
    console.error("TOURGUIDE HANDLER ERROR:", err);
    return { ok: false, text: "Tour guide generation failed.", details: String(err) };
  }
}
