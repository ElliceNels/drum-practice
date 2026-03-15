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

export interface PerformanceScores {
  accuracy: number;
  stability: number;
  consistency: number;
  threshold: number;
}

export interface PerformanceStats {
  target_bpm: number;
  mean_bpm: number;
  median_bpm: number;
  min_bpm: number;
  max_bpm: number;
  std_dev: number;
  variance_coefficient: number;
  percentage_within_threshold: number;
}

export interface PerformanceSummary {
  rank: number;
  description: string;
  scores: PerformanceScores;
  stats: PerformanceStats;
}

export interface LiveStats {
  currentBpm: number | null;
  meanBpm: number | null;
  tempoMatch: "on" | "ahead" | "behind" | null;
}