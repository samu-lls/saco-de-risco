"use client";
import { useEffect, useRef, useState } from "react";

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // Define o volume da música para 15% assim que o componente é montado
    if (audioRef.current) {
      audioRef.current.volume = 0.10;
    }

    const handleFirstInteraction = () => {
      audioRef.current?.play().catch(() => {});
      window.removeEventListener('click', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, []);

  const toggle = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !muted;
    setMuted(!muted);
  };

  return (
    <>
      <audio ref={audioRef} src="/music/theme.ogg" loop preload="auto" />
      <button
        onClick={toggle}
        className="fixed bottom-6 right-6 section-label px-3 py-2 rounded border transition-colors hover:bg-white/5"
        style={{ zIndex: 9997, borderColor: 'rgba(212,168,83,0.25)', color: 'rgba(212,168,83,0.7)' }}
      >
        {muted ? '🔇 SOM' : '🔊 SOM'}
      </button>
    </>
  );
}