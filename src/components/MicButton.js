"use client";

import { useState, useEffect, useRef } from "react";

export default function MicButton({ onResult }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check browser support
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn(
        "Speech recognition is not supported in this browser (iOS Safari, Firefox, Brave, etc.)."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);

    recognition.onend = () => setListening(false);

    recognition.onerror = (event) => {
      const realError = event.error || event.message || event;
      console.error("Speech recognition error:", realError);

      // Display meaningful messages
      if (event.error === "not-allowed") {
        alert("Microphone access blocked. Allow mic permissions to use voice input.");
      }
      if (event.error === "network") {
        alert("Network error. Speech recognition requires a secure HTTPS connection.");
      }
      // ADDED: User-friendly alert for the 'no-speech' error
      if (event.error === "no-speech") {
        alert("We didn't catch any speech. Please try speaking louder or check your microphone.");
      }


      setListening(false);
    };

    // FIX: Changed 'onResult' to 'onSpeech' in the original prompt's response, 
    // but the component is imported in Chat.tsx as MicButton, 
    // and the prop is used as 'onResult' in the provided code snippet from the user. 
    // Assuming 'onResult' is the correct prop name for consistency with Chat.tsx.
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognitionRef.current = recognition;
  }, [onResult]);

  const handleClick = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported on this device or browser.");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  return (
    <button
      onClick={handleClick}
      // MODIFIED: Class names for the correct styling (teal/green rounded button with pencil icon)
      className={`p-3 rounded-full transition ${
        listening 
          ? "bg-red-500 text-white" // Indicate active listening with red
          : "bg-[#009f9e] text-white hover:bg-[#008c8a]" // Use solid teal for the pencil icon
      }`}
      title={listening ? "Listening…" : "Start voice input"}
    >
      <span className="text-xl">
        {/* Using a pencil icon (✏️) to match the visual style in the second image */}
        ✏️
      </span>
    </button>
  );
}