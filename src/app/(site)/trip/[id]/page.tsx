export default function TripDetailPage({ params }) {
  const { id } = params
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Trip Itinerary</h1>
      <p className="text-gray-600 mt-2">Trip ID: {id}</p>
      <p className="mt-4 text-gray-500">Coming soon — itinerary details here.</p>
    </div>
  )
}
