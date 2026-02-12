"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
      if (!error) alert("Success! Check your email.");
    }
    setLoading(false);
    if (error) alert(error.message);
    else setShowAuthModal(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <nav style={navStyle}>
      {/* TRÁI: LOGO */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Image src="/logo.png" alt="Logo" width={35} height={35} />
        <Link href="/" style={logoTextStyle}>TripPuddy</Link>
      </div>

      {/* GIỮA: MENU ĐẦY ĐỦ */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/itinerary" style={navLinkStyle}>Build Trip</Link>
        <Link href="/my-trips" style={navLinkStyle}>My Trips</Link>
        <Link href="/chat" style={navLinkStyle}>Chat AI</Link>
        <Link href="/contact" style={navLinkStyle}>Contact</Link>
        <Link href="/about" style={navLinkStyle}>About</Link>
      </div>

      {/* PHẢI: CHUÔNG & USER */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ fontSize: "24px", cursor: "pointer" }}>🔔</span>

        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#facc15", fontWeight: "bold", fontSize: "15px" }}>
              {user.email.split('@')[0]}
            </span>
            <button onClick={logout} style={logoutButtonStyle}>Logout</button>
          </div>
        ) : (
          <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={loginButtonStyle}>
            Login
          </button>
        )}
      </div>

      {/* MODAL (GIỮ NGUYÊN LOGIC CỦA BẠN) */}
      {showAuthModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2 style={{ color: '#1e3a8a', marginBottom: 20 }}>Welcome</h2>
            <button onClick={handleGoogleLogin} style={socialButtonStyle}>
               <img src="https://www.svgrepo.com/show/475656/google-color.svg" width="18" alt="G" />
               Continue with Google
            </button>
            <div style={divider}><span>OR</span></div>
            <form onSubmit={handleAuthAction}>
              <input type="email" placeholder="Email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? "text" : "password"} placeholder="Password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <span onClick={() => setShowPassword(!showPassword)} style={eyeIconStyle}>{showPassword ? "👁️" : "🙈"}</span>
              </div>
              <button type="submit" disabled={loading} style={submitButtonStyle}>
                {loading ? '...' : (authType === 'login' ? 'Login' : 'Sign Up')}
              </button>
            </form>
            <button onClick={() => setShowAuthModal(false)} style={cancelButtonStyle}>Cancel</button>
          </div>
        </div>
      )}
    </nav>
  );
}

// --- CSS STYLES ---
const navStyle = {
  background: "#1e3a8a", padding: "10px 25px", display: "flex", 
  justifyContent: "space-between", alignItems: "center", position: "fixed", 
  top: 0, left: 0, right: 0, zIndex: 1000, height: "65px"
};

const logoTextStyle = { color: "#fff", textDecoration: "none", fontSize: 24, fontWeight: "bold" };
const navLinkStyle = { fontSize: "15px", color: "#facc15", textDecoration: "none", fontWeight: "600" };

const loginButtonStyle = {
  padding: "8px 20px", background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
  borderRadius: "20px", fontSize: "14px", fontWeight: "bold", color: "white", border: "none", cursor: "pointer"
};

const logoutButtonStyle = {
  padding: "6px 15px", background: "#ef4444", borderRadius: "20px", 
  fontSize: "13px", fontWeight: "bold", color: "white", border: "none", cursor: "pointer"
};

const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 };
const modalContent = { background: 'white', padding: '25px', borderRadius: '15px', width: '320px', textAlign: 'center' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' };
const eyeIconStyle = { position: 'absolute', right: '10px', top: '8px', cursor: 'pointer' };
const submitButtonStyle = { width: '100%', padding: '10px', borderRadius: '6px', background: '#1e3a8a', color: 'white', fontWeight: 'bold', border: 'none', cursor: "pointer" };
const socialButtonStyle = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px', fontWeight: '600' };
const divider = { display: 'flex', alignItems: 'center', margin: '12px 0', color: '#999', fontSize: '11px' };
const cancelButtonStyle = { background: 'none', border: 'none', color: '#666', marginTop: '8px', cursor: 'pointer', fontSize: '12px' };