"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // New state for mobile toggle
  const [authType, setAuthType] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    let error;
    if (authType === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      error = err;
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      error = err;
    }
    setLoading(false);
    if (error) alert(error.message);
    else setShowAuthModal(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsMenuOpen(false); // Close menu on logout
    router.refresh();
  };

  return (
    <nav style={navStyle}>
      {/* --- LEFT: LOGO --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Image src="/logo.png" alt="Logo" width={35} height={35} />
        <Link href="/" style={logoTextStyle}>TripPuddy</Link>
      </div>

      {/* --- CENTER: DESKTOP LINKS (Hidden on Mobile) --- */}
      <div className="hidden md:flex" style={{ alignItems: "center", gap: 25 }}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/itinerary" style={navLinkStyle}>Build Trip</Link>
        <Link href="/my-trips" style={navLinkStyle}>My Trips</Link>
        <Link href="/chat" style={navLinkStyle}>Chat AI</Link>
        <Link href="/contact" style={navLinkStyle}>Contact</Link>
      </div>

      {/* --- RIGHT: DESKTOP AUTH (Hidden on Mobile) --- */}
      <div className="hidden md:flex" style={{ alignItems: "center", gap: 20 }}>
        <span style={{ fontSize: "22px", cursor: "pointer", color: "white" }}>🔔</span>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <span style={{ color: "#facc15", fontWeight: "bold", fontSize: "14px" }}>
              {user.email.split('@')[0]}
            </span>
            <button onClick={logout} style={logoutButtonStyle}>Logout</button>
          </div>
        ) : (
          <button 
            onClick={() => { setAuthType('login'); setShowAuthModal(true); }} 
            style={loginButtonStyle}
          >
            Login
          </button>
        )}
      </div>

      {/* --- MOBILE: HAMBURGER BUTTON (Only visible on small screens) --- */}
      {/* --- MOBILE: HAMBURGER BUTTON --- */}
      <div className="md:hidden flex items-center">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{ 
            background: "rgba(255,255,255,0.15)", 
            border: "1px solid rgba(255,255,255,0.2)", 
            color: "white", 
            cursor: "pointer", 
            padding: "6px 12px", 
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: "8px", // Space between text and icon
            outline: "none"
          }}
        >
          {/* Added MENU text */}
          <span style={{ fontSize: "13px", fontWeight: "bold", letterSpacing: "0.5px" }}>MENU</span>
          
          {isMenuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          )}
        </button>
      </div>

      {/* --- MOBILE: DROPDOWN MENU --- */}
      {isMenuOpen && (
        <div style={mobileMenuStyle}>
          <Link href="/" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>Home</Link>
          <Link href="/itinerary" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>AI Instant Ininerary</Link>
          <Link href="/chat" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>AI Custom Plan</Link>
          <Link href="/my-trips" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>My Trips</Link>
          <Link href="/ai-assistant" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>Chat</Link>         
          
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", width: "100%", margin: "10px 0" }} />
          
          {user ? (
            <div style={{ textAlign: "center", width: "100%" }}>
              <p style={{ color: "#facc15", marginBottom: "15px", fontWeight: "bold" }}>Hi, {user.email.split('@')[0]}</p>
              <button onClick={logout} style={{ ...logoutButtonStyle, width: "100%", padding: "12px" }}>Logout</button>
            </div>
          ) : (
            <button 
              onClick={() => { setAuthType('login'); setShowAuthModal(true); setIsMenuOpen(false); }} 
              style={{ ...loginButtonStyle, width: "100%", padding: "12px" }}
            >
              Login
            </button>
          )}
        </div>
      )}

      {/* AUTH MODAL - Keep your original modal code here */}
      {showAuthModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ marginBottom: '20px', color: '#1e3a8a' }}>{authType === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <form onSubmit={handleAuthAction}>
              <input 
                type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} 
                required style={inputStyle} 
              />
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} placeholder="Password" 
                  value={password} onChange={(e) => setPassword(e.target.value)} 
                  required style={inputStyle} 
                />
                <span onClick={() => setShowPassword(!showPassword)} style={eyeIconStyle}>
                  {showPassword ? '👁️' : '🙈'}
                </span>
              </div>
              <button type="submit" disabled={loading} style={submitButtonStyle}>
                {loading ? 'Processing...' : (authType === 'login' ? 'Login' : 'Sign Up')}
              </button>
            </form>
            <p style={{ marginTop: '15px', fontSize: '14px' }}>
              {authType === 'login' ? "Don't have an account? " : "Already have an account? "}
              <span 
                onClick={() => setAuthType(authType === 'login' ? 'signup' : 'login')} 
                style={{ color: '#1e3a8a', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {authType === 'login' ? 'Sign Up' : 'Login'}
              </span>
            </p>
            <button onClick={() => setShowAuthModal(false)} style={{ marginTop: '15px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

// --- STYLES (Cleaned and Fixed for Mobile) ---
const navStyle = {
  background: "#1e3a8a",
  padding: "0 25px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 3000,
  height: "70px",
  borderBottom: "1px solid #1d4ed8",
};

const logoTextStyle = {
  fontSize: "22px",
  fontWeight: "bold",
  color: "white",
  textDecoration: "none",
  letterSpacing: "0.5px"
};

const navLinkStyle = {
  fontSize: "15px",
  color: "white",
  textDecoration: "none",
  fontWeight: "500",
  transition: "color 0.2s"
};

const loginButtonStyle = {
  padding: "8px 22px",
  background: "white",
  borderRadius: "25px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "#1e3a8a",
  border: "none",
  cursor: "pointer",
  transition: "transform 0.2s"
};

const logoutButtonStyle = {
  padding: "8px 22px",
  background: "#ef4444",
  borderRadius: "25px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "white",
  border: "none",
  cursor: "pointer"
};

const mobileMenuStyle = {
  position: "absolute",
  top: "70px",
  left: 0,
  right: 0,
  background: "#1e3a8a",
  display: "flex",
  flexDirection: "column",
  padding: "25px",
  gap: "15px",
  borderBottom: "2px solid #1d4ed8",
  boxShadow: "0 15px 30px rgba(0,0,0,0.4)",
  zIndex: 2999
};

const mobileLinkStyle = { 
  fontSize: "18px", 
  color: "#ffffff", // Forced white for visibility
  textDecoration: "none", 
  fontWeight: "600", 
  padding: "12px", 
  textAlign: "center",
  borderBottom: "1px solid rgba(255,255,255,0.05)"
};

const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 };
const modalContent = { background: 'white', padding: '30px', borderRadius: '20px', width: '340px', textAlign: 'center', boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" };
const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', outline: "none" };
const eyeIconStyle = { position: 'absolute', right: '12px', top: '10px', cursor: 'pointer' };
const submitButtonStyle = { width: '100%', padding: '12px', borderRadius: '8px', background: '#1e3a8a', color: 'white', fontWeight: 'bold', border: 'none', cursor: "pointer", marginTop: "10px" };