export type RecordingStatus =
  | "idle"
  | "recording"
  | "analysing"
  | "error";

export interface ChunkResponse {
  onset: boolean;
  beat: boolean;
  bpm: number | null;
  mean_bpm: number | null;
  tempo_match: "on" | "ahead" | "behind" | null;
  deviation: number | string;
}

export interface PerformanceSummary {
  rank: number;
  description: string;
}

export interface LiveStats {
  currentBpm: number | null;
  meanBpm: number | null;
  tempoMatch: "on" | "ahead" | "behind" | null;
}