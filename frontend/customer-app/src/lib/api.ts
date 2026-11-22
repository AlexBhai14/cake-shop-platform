import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokens';

export const API_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`;

export const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

type FlaggedConfig = InternalAxiosRequestConfig & { _retry?: boolean; _skipRefresh?: boolean };

let sessionExpiredHandler: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  sessionExpiredHandler = fn;
};

// 1. Attach the access token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// 2. Refresh the token. Many requests can fail with 401 at the same moment,
//    but only ONE refresh call is made (refresh tokens rotate, so a second call would break the session).
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await api.post('/auth/refresh', { refreshToken }, { _skipRefresh: true } as FlaggedConfig);
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken as string;
  } catch {
    clearTokens();
    return null;
  }
}

export function refreshSession(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// 3. On 401: refresh once, then repeat the original request
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as FlaggedConfig | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original._skipRefresh && getRefreshToken()) {
      original._retry = true;
      const token = await refreshSession();
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return api(original);
      }
      sessionExpiredHandler?.();
    }
    return Promise.reject(error);
  },
);

export const statusOf = (e: unknown): number | undefined => (axios.isAxiosError(e) ? e.response?.status : undefined);

// Turns any error into a message a customer can read
export function getErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const msg = e.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (e.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.';
    if (!e.response) return 'Cannot reach the shop server. Please check your connection.';
    if (e.response.status === 429) return 'Too many requests. Please wait a moment and try again.';
  }
  return 'Something went wrong. Please try again.';
}
