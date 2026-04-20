"use client";

// Sintetizador Nativo (Web Audio API) - Zero arquivos MP3 necessários!
const playTone = (frequency: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error("Áudio bloqueado pelo navegador", e);
  }
};

export const playClick = () => playTone(600, 'sine', 0.1, 0.05); // Clique de interface
export const playDraw = () => playTone(400, 'triangle', 0.15, 0.1); // Som de sacar carta
export const playError = () => playTone(150, 'sawtooth', 0.4, 0.2); // BZZZT (Curto/Erro)
export const playSuccess = () => { // Arpejo de sucesso (Crafting)
  playTone(400, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(600, 'sine', 0.1, 0.1), 100);
  setTimeout(() => playTone(800, 'sine', 0.2, 0.1), 200);
};