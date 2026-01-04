"use client";

import { useRef, useState } from "react";

export default function MicButton({ onResult }) {
  const [listening, setListening] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Web Speech API refs
  const recognitionRef = useRef(null);

  function hasWebSpeech() {
    return (
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }

  function startWebSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();

    // Let browser auto-detect as much as it can; you can set rec.lang = "en-US" if desired.
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setListening(true);

    rec.onerror = (e) => {
      console.warn("WebSpeech error:", e);
      setListening(false);
      // Fallback to STT upload if WebSpeech fails
      startRecordingUpload();
    };

    rec.onresult = (event) => {
      setListening(false);
      const text = event?.results?.[0]?.[0]?.transcript || "";
      if (text && typeof onResult === "function") onResult(text.trim());
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  }

  function stopWebSpeech() {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setListening(false);
  }

  async function startRecordingUpload() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstart = () => setListening(true);

      recorder.onstop = async () => {
        setListening(false);

        try {
          streamRef.current?.getTracks()?.forEach((t) => t.stop());
        } catch {}

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        const form = new FormData();

        // Send BOTH keys to be compatible with whichever your /api/stt expects
        form.append("audio", blob, "speech.webm");
        form.append("file", blob, "speech.webm");

        try {
          const res = await fetch("/api/stt", { method: "POST", body: form });

          // robust parse
          const ct = res.headers.get("content-type") || "";
          let data = null;

          if (ct.includes("application/json")) data = await res.json();
          else data = { text: "", error: await res.text() };

          if (!res.ok) {
            alert(
              "Voice input is unavailable right now (STT quota/rate limit). Try typing instead."
            );
            console.warn("STT failed:", data);
            return;
          }

          if (data?.text && typeof onResult === "function") {
            onResult(String(data.text).trim());
          } else {
            alert("No speech detected. Please try again.");
          }
        } catch (err) {
          console.error("STT request error:", err);
          alert("Voice input failed. Please try again.");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Microphone access denied or unavailable.");
    }
  }

  function stopRecordingUpload() {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    setListening(false);
  }

  function handleClick() {
    if (listening) {
      // stop whichever mode is active
      if (recognitionRef.current) stopWebSpeech();
      else stopRecordingUpload();
      return;
    }

    // Prefer Web Speech (works even when OpenAI STT quota is exceeded)
    if (hasWebSpeech()) startWebSpeech();
    else startRecordingUpload();
  }

  return (
    <button
      type="button"
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
