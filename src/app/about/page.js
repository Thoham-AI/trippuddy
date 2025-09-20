// src/app/about/page.js
export default function AboutPage() {
  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-green-50 to-teal-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">About TravelAI</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Your AI-powered travel companion that transforms how you discover and experience the world.
          </p>
        </div>

        {/* Mission Section */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Our Mission</h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              At TravelAI, we believe that travel should be accessible, personalized, and unforgettable. 
              Our advanced AI technology helps you discover hidden gems, plan perfect itineraries, and 
              create memories that last a lifetime.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Whether you're a seasoned traveler or planning your first adventure, TravelAI is here to 
              make your journey smoother and more exciting.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <div className="text-6xl text-center mb-6">🌎</div>
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">Why Choose Us?</h3>
            <ul className="space-y-3">
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                <span>AI-powered destination recommendations</span>
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                <span>Personalized travel itineraries</span>
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                <span>Real-time travel insights</span>
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span>
                <span>Local expertise and hidden gems</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl p-6 text-center shadow-lg">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">AI Technology</h3>
            <p className="text-gray-600">Advanced algorithms that understand your travel preferences</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-lg">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">Fast Planning</h3>
            <p className="text-gray-600">Plan your perfect trip in minutes, not hours</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-lg">
            <div className="text-4xl mb-4">🌟</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">Quality Content</h3>
            <p className="text-gray-600">Curated destinations and verified travel information</p>
          </div>
        </div>

        {/* Team Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">Our Team</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            We're a passionate group of travelers, developers, and AI experts dedicated to 
            revolutionizing the way people explore the world.
          </p>
          <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Join Our Community
          </button>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: "About Us - TravelAI",
  description: "Learn about TravelAI and our mission to revolutionize travel planning with AI technology",
};