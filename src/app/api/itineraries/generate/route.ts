import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { destination, days = 3, style = 'relax', budget = 'mid' } = await req.json();

  const prompt = `Create a ${days}-day itinerary for ${destination}.
Style: ${style}. Budget: ${budget}.
Return JSON with fields: summary, plan:[{day, am, pm, eve}].`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });

  const json = JSON.parse(res.choices[0].message?.content ?? '{"summary":"","plan":[]}');
  return NextResponse.json({ itineraryId: crypto.randomUUID(), ...json });
}
