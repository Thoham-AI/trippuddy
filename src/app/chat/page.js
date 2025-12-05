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
        className="relative h-[70vh] w-full flex flex-col items-center justify-center text-center"
        style={{
          backgroundImage: "url('/banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/30"></div>

        <h1 className="relative text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
          What kind of break do you need?
        </h1>

        {/* Mood Buttons */}
        <div className="relative mt-6 flex gap-4 bg-white/80 px-6 py-3 rounded-full shadow-md">
          <button className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 shadow">
            Relax 😌
          </button>
          <button className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 shadow">
            Explore 🧭
          </button>
          <button className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 shadow">
            Escape 🌴
          </button>
        </div>
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
