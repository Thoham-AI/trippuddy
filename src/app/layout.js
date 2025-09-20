// src/app/layout.js
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