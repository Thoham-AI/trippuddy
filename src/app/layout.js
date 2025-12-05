// src/app/layout.js
import "./globals.css";

export const metadata = {
  title: "TripPuddy",
  description: "Your AI-powered travel assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <div className="flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
