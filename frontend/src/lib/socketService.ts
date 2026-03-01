/**
 * Port of legacy/socket.js — Socket.IO client with callback-based API.
 * Replaces DOM CustomEvent pattern with direct callbacks.
 */

import { io, type Socket } from "socket.io-client";
import type { ChunkResponse, PerformanceSummary } from "../data_model/recording";
import { MIN_TEMPO_BPM, MAX_TEMPO_BPM } from "../constants/audio";

const SOCKET_URL = "http://localhost:5000/audio";

let socket: Socket | null = null;

export function connectToSocket(
  onChunkResponse: (data: ChunkResponse) => void,
  onPerformanceSummary: (data: PerformanceSummary) => void,
): Promise<void> {
  if (socket && socket.connected) {
    disconnectFromSocket();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    });

    socket.on("connect_error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    socket.on("chunk_response", (data: ChunkResponse) => {
      onChunkResponse(data);
    });

    socket.on("performance_summary", (data: PerformanceSummary) => {
      onPerformanceSummary(data);
    });
  });
}

export function disconnectFromSocket(): void {
  if (!socket) return;
  socket.off("connect");
  socket.off("chunk_response");
  socket.off("performance_summary");
  socket.disconnect();
  socket = null;
}

export function sendTempoToServer(tempo: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error("Socket not connected"));
    if (
      typeof tempo !== "number" ||
      Number.isNaN(tempo) ||
      tempo < MIN_TEMPO_BPM ||
      tempo > MAX_TEMPO_BPM
    ) {
      return reject(
        new Error(
          `Invalid tempo: must be between ${MIN_TEMPO_BPM} and ${MAX_TEMPO_BPM}`,
        ),
      );
    }

    socket.emit("desired_tempo", { tempo }, (ack: unknown) => {
      resolve(ack);
    });
  });
}

export function sendChunkToServer(arrayBuffer: ArrayBuffer): void {
  if (!socket || !arrayBuffer) return;
  socket.emit("receive_chunk", arrayBuffer);
}

export function sendAudioFileToServer(
  arrayBuffer: ArrayBuffer,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error("Socket not connected"));
    if (!arrayBuffer) return reject(new Error("No audio data provided"));

    socket.emit(
      "receive_audio_file",
      arrayBuffer,
      (ack: { success: boolean; message: string }) => {
        if (ack && ack.success) {
          resolve(ack);
        } else {
          reject(new Error("Server failed to process audio file"));
        }
      },
    );
  });
}