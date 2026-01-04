"use client";

import { useEffect, useRef, useState } from "react";
import MicButton from "./MicButton";
import { getTrips } from "@/lib/storage";

export type Message = {
  role: "user" | "assistant";
  content: string;
  language?: string;
};

const TITLE_KEY = "trippuddy_user_title";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [savedTrips, setSavedTrips] = useState<any[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const [userTitle, setUserTitle] = useState("Boss");
  const [userLocation, setUserLocation] = useState<any>(null);

  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Load saved trips
  useEffect(() => {
    try {
      const stored = getTrips?.() || [];
      setSavedTrips(stored);
    } catch {
      setSavedTrips([]);
    }
  }, []);

  // Restore title
  useEffect(() => {
    try {
      const t = localStorage.getItem(TITLE_KEY);
      if (t) setUserTitle(t);
    } catch {}
  }, []);

  // GPS -> IP fallback
  useEffect(() => {
    if (typeof window === "undefined") return;

    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "GPS location",
        });
      },
      async () => {
        try {
          const r = await fetch("https://ipapi.co/json/");
          const j = await r.json();
          if (j?.latitude && j?.longitude) {
            setUserLocation({
              lat: j.latitude,
              lon: j.longitude,
              label: `${j.city || ""} ${j.region || ""}`.trim() || "IP location",
            });
          }
        } catch {}
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 5000 }
    );
  }, []);

  // Always keep the messages panel scrolled to bottom when new content arrives
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const onTitleChange = (v: string) => {
    setUserTitle(v);
    try {
      localStorage.setItem(TITLE_KEY, v);
    } catch {}
  };

  async function sendMessage(textOverride?: string) {
    if (loading) return;

    const text = (textOverride ?? input).trim();
    if (!text) return;

    const history = [...messages, { role: "user", content: text } as Message];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          userTitle,
          userLocation,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = { reply: "⚠️ Chat response could not be parsed.", language: "en" };
      }

      const replyText =
        data?.reply ||
        data?.message ||
        "⚠️ Something went wrong in /api/chat.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(replyText), language: data?.language },
      ]);
    } catch (err) {
      console.error("Chat send error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Chat failed. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    // Full-height chat panel that scrolls internally (page does not scroll)
    <div className="h-full flex flex-col py-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
          TripPuddy Chat Guide <span className="opacity-60">💬</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="font-semibold text-slate-700">How should I call you?</div>
          <select
            value={userTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 bg-white"
          >
            <option>Boss</option>
            <option>Honey</option>
            <option>Friend</option>
            <option>Sir</option>
            <option>Madam</option>
          </select>
        </div>
      </div>

      {/* Messages area: fills available space and scrolls internally */}
      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto bg-white/70 border border-slate-200 rounded-2xl p-5 shadow-sm"
      >
        {messages.length === 0 ? (
          <div className="text-slate-500">
            Say hello, Boss — or ask for cafes, itinerary ideas, or packing tips.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] mb-3 px-4 py-3 rounded-2xl text-[16px] leading-relaxed ${
                msg.role === "user"
                  ? "ml-auto bg-[#0ea5a4] text-white"
                  : "mr-auto bg-white border border-slate-200"
              }`}
            >
              {msg.content}
            </div>
          ))
        )}

        {loading && (
          <div className="mr-auto bg-white border border-slate-200 px-4 py-3 rounded-2xl w-fit text-sm opacity-70">
            Typing…
          </div>
        )}
      </div>

      {/* Input row stays pinned at bottom */}
      <div className="mt-4 bg-white border border-slate-200 rounded-full px-3 py-2 flex items-center gap-3 shadow-sm">
        <MicButton
          onResult={(t: string) => {
            // Voice transcript behaves like typed message
            sendMessage(t);
          }}
        />

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask TripPuddy anything…"
          className="flex-1 bg-transparent outline-none text-[18px] px-2 py-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />

        <button
          onClick={() => sendMessage()}
          className="bg-[#0ea5a4] hover:bg-[#0b8c8a] text-white font-extrabold px-6 py-3 rounded-full"
          disabled={loading}
          type="button"
        >
          Send
        </button>
      </div>

      {/* Saved Trips collapsible so it won't push the chat off-screen */}
      {savedTrips?.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowSaved((v) => !v)}
            className="font-extrabold text-slate-800 flex items-center gap-2"
          >
            📌 My Saved Trips {showSaved ? "▲" : "▼"}
          </button>

          {showSaved && (
            <div className="mt-3 space-y-3 max-h-[22vh] overflow-y-auto pr-1">
              {savedTrips.map((t: any) => (
                <div
                  key={t.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4"
                >
                  <div className="text-xl font-extrabold">{t.destination}</div>
                  <div className="text-slate-700">
                    {String(t.summary || "").slice(0, 160)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
