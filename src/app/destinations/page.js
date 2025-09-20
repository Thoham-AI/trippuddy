// src/app/destinations/page.js
export default function DestinationsPage() {
  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Explore Destinations</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover amazing travel destinations around the world with AI-powered recommendations
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Destination Cards will go here */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl mb-4">🌍</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Destinations Coming Soon!</h2>
            <p className="text-gray-600">We're preparing amazing travel destinations for you</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Destinations - TravelAI",
  description: "Explore amazing travel destinations around the world",
};