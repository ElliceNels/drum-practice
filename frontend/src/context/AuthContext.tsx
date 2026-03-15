import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthUser } from "../data_model/auth";
import { setToken, clearToken, getToken } from "../lib/apiClient";
import {
  login as authLogin,
  signup as authSignup,
  logout as authLogout,
  currentUser as authCurrentUser,
} from "../lib/authService";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate user from stored token on mount
  useEffect(() => {
    const storedToken = getToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    authCurrentUser()
      .then((u) => {
        setUser(u);
        setTokenState(storedToken);
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setTokenState(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Listen for 401 unauthorized events from apiClient
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setTokenState(null);
    };
    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authLogin(username, password);
    setToken(res.session_token);
    setTokenState(res.session_token);
    setUser({ user_id: res.user_id, username: res.username });
  }, []);

  const signup = useCallback(async (username: string, password: string) => {
    const res = await authSignup(username, password);
    setToken(res.session_token);
    setTokenState(res.session_token);
    setUser({ user_id: res.user_id, username: res.username });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } finally {
      clearToken();
      setUser(null);
      setTokenState(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}