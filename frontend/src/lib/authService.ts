/**
 * Auth service — login, signup, logout, currentUser via apiClient.
 */

import { apiClient } from "./apiClient";
import type { AuthUser } from "../data_model/auth";

interface LoginResponse {
  session_token: string;
  user_id: number;
  username: string;
}

interface SignupResponse {
  session_token: string;
  user_id: number;
  username: string;
}

interface CurrentUserResponse {
  user_id: number;
  username: string;
  created_at: string;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return apiClient<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function signup(
  username: string,
  password: string,
): Promise<SignupResponse> {
  return apiClient<SignupResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<void> {
  await apiClient<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}

export async function currentUser(): Promise<AuthUser> {
  const data = await apiClient<CurrentUserResponse>("/auth/current_user");
  return {
    user_id: data.user_id,
    username: data.username,
    created_at: data.created_at,
  };
}
