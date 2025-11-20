// src/app/api/booking/route.js
export async function POST(req) {
  const { city } = await req.json();

  // Mock data — sau này thay bằng Booking.com API thật
  const hotels = [
    {
      name: "Hotel Central",
      price: "$120/night",
      rating: 8.5,
    },
    {
      name: "Riverside Resort",
      price: "$95/night",
      rating: 8.0,
    },
  ];

  return new Response(JSON.stringify({ city, hotels }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
