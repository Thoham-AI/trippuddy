"use client";

import { useEffect, useRef, useState } from "react";

export default function MicButton({ onTranscript }) {
  const recognitionRef = useRef(null);
  const startingRef = useRef(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recog = new SpeechRecognition();
    recog.lang = "en-US"; // change to "vi-VN" for Vietnamese
    recog.interimResults = false;

    recog.onstart = () => setListening(true);
    recog.onend = () => {
      setListening(false);
      startingRef.current = false;
    };

    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onTranscript(transcript);
    };

    recog.onerror = () => {
      setListening(false);
      startingRef.current = false;
    };

    recognitionRef.current = recog;
  }, [onTranscript]);

  const toggleMic = () => {
    const recog = recognitionRef.current;
    if (!recog) return;

    // Prevent invalid-state spam
    if (startingRef.current) return;

    startingRef.current = true;

    if (!listening) {
      try {
        recog.start();
      } catch {
        setTimeout(() => recog.start(), 300);
      }
    } else {
      try {
        recog.stop();
      } catch {}
    }
  };

  return (
    <button
      onClick={toggleMic}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: listening ? "#dc2626" : "#1e40af",
        color: "white",
        border: "none",
        fontSize: 20,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
        boxShadow: listening
          ? "0 0 12px rgba(220,38,38,0.6)"
          : "0 0 8px rgba(0,0,0,0.2)",
        transition: "0.25s ease",
      }}
    >
      🎤
    </button>
  );
}
