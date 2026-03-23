export interface SessionStatsSummary {
  mean_bpm: number | null;
  target_bpm: number | null;
}

export interface SessionScoreSummary {
  rank: number;
  rank_description: string;
  accuracy: number | null;
}

export interface SessionSummary {
  session_id: number;
  recorded_at: string | null;
  file_location: string;
  length_seconds: number;
  stats_summary?: SessionStatsSummary;
  score_summary?: SessionScoreSummary;
}

export interface SessionStats {
  target_bpm: number;
  mean_bpm: number;
  median_bpm: number;
  min_bpm: number;
  max_bpm: number;
  std_dev: number;
  variance_coefficient: number;
  percentage_within_threshold: number;
}

export interface SessionScore {
  accuracy: number;
  stability: number;
  consistency: number;
  threshold: number;
  rank: number;
  rank_description: string;
}

export interface SessionDetail {
  session_id: number;
  user_id: number;
  recorded_at: string | null;
  file_location: string;
  length_seconds: number;
  stats?: SessionStats;
  score?: SessionScore;
}

export interface SaveSessionPayload {
  file_location: string;
  length_seconds: number;
  stats?: SessionStats;
  score?: SessionScore;
}