import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints';
import { refreshSession, setSessionExpiredHandler } from '../lib/api';
import { SessionUser, userFromToken } from '../lib/jwt';
import { clearTokens, getRefreshToken, setTokens } from '../lib/tokens';

export interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSessionExpiredHandler(() => setUser(null));
    (async () => {
      if (getRefreshToken()) {
        const token = await refreshSession();
        const restored = token ? userFromToken(token) : null;
        if (!cancelled && restored?.role === 'ADMIN') setUser(restored);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        /* logged out locally anyway */
      }
    }
    clearTokens();
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    const session = userFromToken(tokens.accessToken);
    if (session?.role !== 'ADMIN') {
      // A customer account must not stay signed in here. (The backend rejects their admin calls anyway.)
      try {
        await authApi.logout(tokens.refreshToken);
      } catch {
        /* ignore */
      }
      throw new Error('NOT_ADMIN');
    }
    setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(session);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
