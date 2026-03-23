"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authType, setAuthType] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav style={navStyle}>
      <div style={containerStyle}>
        {/* Logo */}
        <Link href="/" style={logoStyle}>
          <span style={{ color: "white" }}>TripPuddy</span>
        </Link>

        {/* Desktop Menu: Dùng class 'hidden md:flex' của Tailwind */}
        <div className="hidden md:flex" style={{ alignItems: "center", gap: "25px" }}>
          <Link href="/chat" style={linkStyle}>Explore</Link>
          <Link href="/itinerary" style={linkStyle}>Itinerary</Link>
          {user ? (
            <button onClick={handleSignOut} style={logoutButtonStyle}>Logout</button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={loginButtonStyle}>Login</button>
          )}
        </div>

        {/* Mobile Toggle: Dùng class 'flex md:hidden' của Tailwind */}
        <button 
          className="flex md:hidden flex-col justify-center items-center"
          style={{ background: "none", border: "none", cursor: "pointer", gap: "4px" }}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <div style={{ width: "25px", height: "3px", background: "white" }}></div>
          <div style={{ width: "25px", height: "3px", background: "white" }}></div>
          <div style={{ width: "25px", height: "3px", background: "white" }}></div>
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden" style={mobileMenuStyle}>
          <Link href="/chat" style={mobileLinkStyle} onClick={() => setIsMenuOpen(false)}>Explore</Link>
          <Link href="/itinerary" style={mobileLinkStyle} onClick={() => setIsMenuOpen(false)}>Itinerary</Link>
          <div style={{ padding: "10px" }}>
            {user ? (
              <button onClick={handleSignOut} style={{ ...logoutButtonStyle, width: "100%" }}>Logout</button>
            ) : (
              <button onClick={() => { setShowAuthModal(true); setIsMenuOpen(false); }} style={{ ...loginButtonStyle, width: "100%" }}>Login</button>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal Placeholder (Giữ nguyên logic cũ của bạn) */}
      {showAuthModal && (
        <div style={modalOverlay}>
            <div style={modalContent}>
                <button onClick={() => setShowAuthModal(false)} style={{ float: 'right', border: 'none', background: 'none', fontSize: '20px' }}>&times;</button>
                <h2 style={{ color: '#06b6d4', marginBottom: '20px' }}>{authType === 'login' ? 'Login' : 'Sign Up'}</h2>
                <form onSubmit={(e) => e.preventDefault()}>
                    <input type="email" placeholder="Email" style={inputStyle} />
                    <input type="password" placeholder="Password" style={inputStyle} />
                    <button style={submitButtonStyle}>Submit</button>
                </form>
            </div>
        </div>
      )}
    </nav>
  );
}

/* --- STYLES ĐỒNG BỘ CYAN --- */
const navStyle = {
  position: "fixed", top: 0, left: 0, right: 0, height: "70px",
  backgroundColor: "#06b6d4", // Màu Cyan chủ đạo
  display: "flex", alignItems: "center", zIndex: 3000,
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
};

const containerStyle = {
  width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "0 20px",
  display: "flex", justifyContent: "space-between", alignItems: "center",
};

const logoStyle = { fontSize: "24px", fontWeight: "800", textDecoration: "none" };

const linkStyle = { color: "white", textDecoration: "none", fontWeight: "600", fontSize: "15px" };

const loginButtonStyle = {
  padding: "8px 20px", background: "white", color: "#06b6d4",
  borderRadius: "20px", fontWeight: "bold", border: "none", cursor: "pointer"
};

const logoutButtonStyle = {
  padding: "8px 20px", background: "#ef4444", color: "white",
  borderRadius: "20px", fontWeight: "bold", border: "none", cursor: "pointer"
};

const mobileMenuStyle = {
  position: "absolute", top: "70px", left: 0, right: 0,
  backgroundColor: "#0891b2", // Cyan đậm hơn cho menu mobile
  display: "flex", flexDirection: "column", padding: "10px 0", zIndex: 2999,
};

const mobileLinkStyle = {
  color: "white", textDecoration: "none", fontSize: "18px",
  fontWeight: "bold", textAlign: "center", padding: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)"
};

const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 };
const modalContent = { background: 'white', padding: '30px', borderRadius: '15px', width: '320px', textAlign: 'center' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ddd' };
const submitButtonStyle = { width: '100%', padding: '10px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' };