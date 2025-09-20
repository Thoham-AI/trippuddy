import { destinationsData } from "../../../generate-destinations/data";

export async function GET() {
  const uniqueDestinations = Array.from(
    new Map(destinationsData.map((d) => [d.name, d])).values()
  );

  return new Response(JSON.stringify(uniqueDestinations), {
    headers: { "Content-Type": "application/json" },
  });
}
