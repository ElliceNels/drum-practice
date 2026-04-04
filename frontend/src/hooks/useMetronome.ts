import { useRef, useCallback, useEffect } from "react";

/**
 * Metronome hook using Web Audio API.
 * Plays a short click at the given BPM using an OscillatorNode.
 * Uses a separate AudioContext so clicks go to speakers but aren't
 * captured by getUserMedia (echo cancellation is off).
 */
export function useMetronome() {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  const playClick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Short sine tone: 1000 Hz for 30ms — clean, audible click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 1000;
    gain.gain.value = 0.3;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.start(now);
    // Quick fade-out to avoid click/pop artifacts
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.stop(now + 0.03);
  }, []);

  const startMetronome = useCallback((bpm: number) => {
    // Stop any existing metronome
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    // Create audio context if needed
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }

    const intervalMs = (60 / bpm) * 1000;

    // Play first click immediately
    playClick();

    // Schedule subsequent clicks
    intervalRef.current = window.setInterval(playClick, intervalMs);
  }, [playClick]);

  const stopMetronome = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMetronome();
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, [stopMetronome]);

  return { startMetronome, stopMetronome };
}
