/**
 * Session service — CRUD for practice sessions via apiClient.
 */

import { apiClient } from "./apiClient";
import type {
  SessionSummary,
  SessionDetail,
  SaveSessionPayload,
} from "../data_model/session";

interface SaveSessionResponse {
  session_id: number;
  message: string;
}

interface GetSessionsResponse {
  sessions: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

export async function saveSession(
  payload: SaveSessionPayload,
): Promise<SaveSessionResponse> {
  return apiClient<SaveSessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSessions(
  orderBy = "recorded_at",
  orderDir = "desc",
  limit = 100,
  offset = 0,
): Promise<GetSessionsResponse> {
  const params = new URLSearchParams({
    order_by: orderBy,
    order_dir: orderDir,
    limit: String(limit),
    offset: String(offset),
  });
  return apiClient<GetSessionsResponse>(`/sessions?${params}`);
}

export async function getSession(sessionId: number): Promise<SessionDetail> {
  return apiClient<SessionDetail>(`/sessions/${sessionId}`);
}

export async function deleteSession(
  sessionId: number,
): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/sessions/${sessionId}`, {
    method: "DELETE",
  });
}
