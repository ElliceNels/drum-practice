/**
 * Port of legacy/recording.js as a React hook.
 * Manages mic capture via AudioWorklet, streams chunks to the server,
 * and builds a WAV file on stop.
 */

import { useRef, useState, useCallback } from "react";
import { SAMPLE_RATE, REVOKE_TIMEOUT_MS } from "../constants/audio";
import {
  connectToSocket,
  disconnectFromSocket,
  sendChunkToServer,
  sendAudioFileToServer,
  sendTempoToServer,
} from "../lib/socketService";
import { buildWavFile, mergeFloat32Arrays } from "../lib/wavUtils";
import type { PerformanceSummary } from "../data_model/recording";

export type RecorderStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "analysing"
  | "done"
  | "error";

interface UseAudioRecorderReturn {
  status: RecorderStatus;
  error: string | null;
  summary: PerformanceSummary | null;
  start: (tempo?: number) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (tempo?: number) => {
    setError(null);
    setSummary(null);
    setStatus("connecting");

    try {
      // Connect socket with callbacks
      await connectToSocket(
        () => {},
        (data) => {
          setSummary(data);
          setStatus("done");
        },
      );

      // Send tempo if provided
      if (tempo !== undefined) {
        await sendTempoToServer(tempo);
      }

      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // Set up AudioContext + Worklet
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
        await audioCtxRef.current.audioWorklet.addModule("./pcm_processor.js");
      }

      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      // Create worklet node
      const worklet = new AudioWorkletNode(
        audioCtxRef.current,
        "pcm-processor",
      );
      workletRef.current = worklet;
      chunksRef.current = [];

      worklet.port.onmessage = (event) => {
        const float32: Float32Array = event.data;
        chunksRef.current.push(float32);
        sendChunkToServer(float32.buffer as ArrayBuffer);
      };

      // Connect mic → worklet
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      micSourceRef.current = source;
      source.connect(worklet);

      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setStatus("error");
      disconnectFromSocket();
    }
  }, []);

  const stop = useCallback(async () => {
    // Suspend audio to stop capture
    if (audioCtxRef.current?.state === "running") {
      await audioCtxRef.current.suspend();
    }

    // Disconnect worklet
    if (workletRef.current) {
      workletRef.current.disconnect();
      workletRef.current.port.onmessage = null;
      workletRef.current = null;
    }

    // Stop mic tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    micSourceRef.current = null;

    setStatus("analysing");

    // Merge chunks and build WAV
    const merged = mergeFloat32Arrays(chunksRef.current);
    const sampleRate = audioCtxRef.current?.sampleRate ?? SAMPLE_RATE;
    const wavBlob = buildWavFile(merged, sampleRate);

    // Send full file to server
    try {
      const arrayBuffer = await wavBlob.arrayBuffer();
      await sendAudioFileToServer(arrayBuffer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send audio");
      setStatus("error");
      disconnectFromSocket();
      return;
    }

    // Download locally
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recording.wav";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_TIMEOUT_MS);

    // Status stays "analysing" until performance_summary arrives via socket callback
  }, []);

  const reset = useCallback(() => {
    disconnectFromSocket();
    setStatus("idle");
    setError(null);
    setSummary(null);
  }, []);

  return { status, error, summary, start, stop, reset };
}
