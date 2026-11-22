import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints';
import { refreshSession, setSessionExpiredHandler } from '../lib/api';
import { SessionUser, userFromToken } from '../lib/jwt';
import { clearTokens, getRefreshToken, setTokens } from '../lib/tokens';

export interface AuthState {
  user: SessionUser | null;
  loading: boolean; // true while a saved session is being restored after a page reload
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
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
        const token = await refreshSession(); // restore the session after a reload
        if (!cancelled && token) setUser(userFromToken(token));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(userFromToken(tokens.accessToken));
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      await authApi.register(email, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken); // revokes the refresh token on the server
      } catch {
        /* even if this fails the user is logged out locally */
      }
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
