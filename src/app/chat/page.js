// src/app/chat/page.js
"use client";

import { useEffect, useState } from "react";

async function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 4000 }
    );
  });
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [salutation, setSalutation] = useState("Boss");
  const [loading, setLoading] = useState(false);

  /* -------------------------------------------
     VOICE RECOGNITION (single clean instance)
  --------------------------------------------*/
  const [isListening, setIsListening] = useState(false);
  let recognition;

  if (typeof window !== "undefined") {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = false;
    }
  }

  const startListening = () => {
    if (!recognition) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    setIsListening(true);
    recognition.start();

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  /* -------------------------------------------
     LOAD SALUTATION FROM LOCALSTORAGE
  --------------------------------------------*/
  useEffect(() => {
    const saved = window.localStorage.getItem("tp_salutation");
    if (saved) setSalutation(saved);
  }, []);

  const handleSalutationChange = (value) => {
    setSalutation(value);
    window.localStorage.setItem("tp_salutation", value);
  };

  /* -------------------------------------------
     DAILY TOUR-GUIDE GREETING
  --------------------------------------------*/
  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const last = window.localStorage.getItem("tp_last_welcome_date");
    if (last === todayKey) return;

    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        await fetchTourGuideGreeting({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      async () => {
        await fetchTourGuideGreeting(null);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );

    async function fetchTourGuideGreeting(location) {
      try {
        const res = await fetch("/api/tourguide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salutation,
            localTime: new Date().toISOString(),
            location,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();

        if (data.message) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.message },
          ]);
          window.localStorage.setItem("tp_last_welcome_date", todayKey);
        }
      } catch (err) {
        console.error("Tourguide greeting error:", err);
      }
    }
  }, [salutation]);

  /* -------------------------------------------
     SEND MESSAGE
  --------------------------------------------*/
  async function handleSend() {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          salutation,
          location: await getLocation(),
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "(no reply)" },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble responding." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------
     RENDER UI
  --------------------------------------------*/
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        paddingTop: "120px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          padding: "0 16px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#fff",
            padding: "16px 18px",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            TripPuddy Chat Guide 💬
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>How should I call you?</span>
            <select
              value={salutation}
              onChange={(e) => handleSalutationChange(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            >
              <option value="Boss">Boss</option>
              <option value="Honey">Honey</option>
              <option value="Buddy">Buddy</option>
              <option value="Friend">Friend</option>
            </select>
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            minHeight: "300px",
            maxHeight: "60vh",
            overflowY: "auto",
            background: "#fff",
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 10,
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background:
                    m.role === "user" ? "#0d9488" : "rgba(15,23,42,0.05)",
                  color: m.role === "user" ? "white" : "#0f172a",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    marginBottom: 4,
                  }}
                >
                  {m.role === "user" ? "You" : "TripPuddy"}
                </div>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {/* Input row */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "#fff",
            borderRadius: 999,
            padding: "8px 10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <input
            type="text"
            placeholder="Speak or type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 999,
              border: "none",
              outline: "none",
            }}
          />

          {/* Microphone */}
          <button
            onClick={startListening}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: isListening ? "#dc2626" : "#1e40af",
              color: "white",
              border: "none",
              fontSize: 18,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            🎤
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={loading}
            style={{
              background: loading ? "#9ca3af" : "#0d9488",
              color: "white",
              borderRadius: 999,
              padding: "10px 20px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {loading ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
