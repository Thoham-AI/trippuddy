// src/app/layout.js
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "TripPuddy",
  description: "Your AI-powered travel assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Travelpayouts Ownership Verification */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                  var script = document.createElement("script");
                  script.async = 1;
                  script.src = 'https://emrldtp.com/NDgwNzQz.js?t=480743';
                  document.head.appendChild(script);
              })();
            `,
          }}
        />
      </head>

      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <div className="flex flex-col min-h-screen">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
