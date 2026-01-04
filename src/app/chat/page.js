"use client";

import Navbar from "@/components/Navbar";
import Chat from "@/components/Chat";
import "../globals.css";

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-[#EFF3F8] flex flex-col">

      {/* NAVBAR */}
      <Navbar />

      {/* HERO BANNER */}
      <section
        className="relative h-[30vh] w-full flex flex-col items-center justify-center text-center"
        style={{
          backgroundImage: "url('/banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >

      </section>

      {/* CHAT SECTION */}
      <div className="w-full flex justify-center pb-20">
        <div className="w-full max-w-4xl px-4">
          <Chat />
        </div>
      </div>
    </div>
  );
}
