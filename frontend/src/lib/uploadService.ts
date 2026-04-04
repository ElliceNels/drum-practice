/**
 * Upload service — sends audio files for offline analysis via REST.
 */

import { getToken } from "./apiClient";
import type { PerformanceSummary } from "../data_model/recording";

const ACCEPTED_FORMATS = ".wav,.mp3,.mp4,.m4a,.ogg,.flac";

export { ACCEPTED_FORMATS };

export async function uploadForAnalysis(
  file: File,
  targetBpm?: number,
): Promise<PerformanceSummary> {
  const token = getToken();

  const formData = new FormData();
  formData.append("file", file);
  if (targetBpm !== undefined) {
    formData.append("target_bpm", String(targetBpm));
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Don't set Content-Type — browser sets it with boundary for multipart

  const response = await fetch("/upload/analyze", {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Upload failed");
  }

  return data as PerformanceSummary;
}
