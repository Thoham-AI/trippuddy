export default function Home() {
  return (
    <div>

      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo text-3xl font-bold">TripPuddy</div>
        <div className="navbar-links">
          <a href="/">Home</a>
          <a href="/itinerary">Itinerary</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </div>
        <a href="/login" className="nav-login-btn">Login</a>
      </div>

      {/* HERO SECTION */}
      <div
        className="hero"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1950&q=80')",
        }}
      >
        <h1 className="hero-title">What kind of break do you need?</h1>

        <div className="hero-buttons">
          <button>😌 Relax</button>
          <button>🧭 Explore</button>
          <button>🌴 Escape</button>
        </div>
      </div>
    </div>
  );
}
