import "leaflet/dist/leaflet.css";
import "./globals.css";
import Navbar from "../components/Navbar";
import ClientShell from "./client-shell";

export const metadata = {
  title: "TripPuddy",
  description: "Your AI travel companion",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}
