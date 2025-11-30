"use client";

import { usePathname } from "next/navigation";
import Navbar from "../components/Navbar";

export default function ClientShell({ children }) {
  const pathname = usePathname();

  // Hide Navbar + Chat Bubble on /chat
  const hideNavbar = pathname === "/chat";

  return (
    <>
      {!hideNavbar && <Navbar />}

      <main className={hideNavbar ? "" : "pt-16"}>
        {children}
      </main>

      {/* Floating Chat Button */}
      {!hideNavbar && (
        <a
          href="/chat"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#2563eb",
            color: "white",
            borderRadius: "50%",
            width: "64px",
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            fontWeight: "bold",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            textDecoration: "none",
            zIndex: 50,
          }}
          title="AI Travel Chat"
        >
          💬
        </a>
      )}
    </>
  );
}
