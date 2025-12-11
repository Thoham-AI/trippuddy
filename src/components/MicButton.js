"use client";

import { useState, useRef } from "react";

export default function MicButton({ onResult }) {
  const [listening, setListening] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // --- START RECORDING USING MEDIARECORDER (Whisper-compatible) ---
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm"
      });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstart = () => {
        console.log("🎙 Whisper recording started");
        setListening(true);
      };

      recorder.onstop = async () => {
        console.log("🛑 Whisper recording stopped");
        setListening(false);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("file", blob, "speech.webm");

        try {
          const res = await fetch("/api/stt", {
            method: "POST",
            body: form
          });

          const data = await res.json();

          if (data.text && typeof onResult === "function") {
            onResult(data.text.trim());
          } else {
            console.warn("Whisper STT returned no text.");
          }
        } catch (err) {
          console.error("Whisper STT error:", err);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Microphone access denied or unavailable.");
    }
  }

  // --- STOP RECORDING ---
  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  }

  // --- BUTTON CLICK HANDLER ---
  const handleClick = () => {
    if (listening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // --- UI (unchanged) ---
  return (
    <button
      onClick={handleClick}
      className={`p-3 rounded-full transition ${
        listening
          ? "bg-red-500 text-white"
          : "bg-[#009f9e] text-white hover:bg-[#008c8a]"
      }`}
      title={listening ? "Listening…" : "Start voice input"}
    >
      <span className="text-xl">🎤</span>
    </button>
  );
}
