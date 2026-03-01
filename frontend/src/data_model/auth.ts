export interface AuthUser {
  user_id: number;
  username: string;
  created_at?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
}