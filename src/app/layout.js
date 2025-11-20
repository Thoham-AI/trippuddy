// src/app/layout.js
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Navbar from "../components/Navbar";

export const metadata = {
  title: "Travel AI App",
  description: "Your AI travel companion",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <Navbar />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}

{/* Floating Chat Button */}
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
