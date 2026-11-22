import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authApi } from '../api/endpoints';
import { api, getErrorMessage, setSessionExpiredHandler } from './api';
import { clearTokens, getAccessToken, setTokens } from './tokens';

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown };

// Replaces the network with a fake server so the interceptors can be tested without a backend
function useFakeServer(handler: Handler) {
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') await new Promise((r) => setTimeout(r, 20));
    const { status, data = {} } = handler(config);
    const response = { data, status, statusText: '', headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError('Request failed', String(status), config, {}, response as never);
  };
}

describe('axios interceptors', () => {
  beforeEach(() => {
    clearTokens();
    localStorage.clear();
    setSessionExpiredHandler(null);
  });

  it('adds the access token to every request', async () => {
    setTokens('access-1', 'refresh-1');
    let seen = '';
    useFakeServer((config) => {
      seen = String(config.headers.get('Authorization'));
      return { status: 200 };
    });
    await api.get('/cart');
    expect(seen).toBe('Bearer access-1');
  });

  it('refreshes the token once and repeats the request after a 401', async () => {
    setTokens('old-access', 'refresh-1');
    const calls: string[] = [];
    useFakeServer((config) => {
      calls.push(`${config.method} ${config.url}`);
      if (config.url === '/auth/refresh') {
        return { status: 200, data: { accessToken: 'new-access', refreshToken: 'refresh-2' } };
      }
      return config.headers.get('Authorization') === 'Bearer new-access'
        ? { status: 200, data: { ok: true } }
        : { status: 401 };
    });

    const res = await api.get('/orders');

    expect(res.data).toEqual({ ok: true });
    expect(calls).toEqual(['get /orders', 'post /auth/refresh', 'get /orders']);
    expect(getAccessToken()).toBe('new-access');
    expect(localStorage.getItem('cake.refreshToken')).toBe('refresh-2');
  });

  it('makes only ONE refresh call when several requests fail at the same time', async () => {
    setTokens('old', 'refresh-1');
    let refreshCalls = 0;
    useFakeServer((config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls++;
        return { status: 200, data: { accessToken: 'new', refreshToken: 'refresh-2' } };
      }
      return config.headers.get('Authorization') === 'Bearer new' ? { status: 200 } : { status: 401 };
    });
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(refreshCalls).toBe(1);
  });

  it('logs the user out when the refresh fails', async () => {
    setTokens('old', 'bad-refresh');
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    useFakeServer(() => ({ status: 401 }));

    await expect(api.get('/orders')).rejects.toBeDefined();

    expect(expired).toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('cake.refreshToken')).toBeNull();
  });

  it('does not try to refresh when a login attempt fails (wrong password is not an expired token)', async () => {
    setTokens('a', 'r');
    let refreshCalls = 0;
    useFakeServer((config) => {
      if (config.url === '/auth/refresh') refreshCalls++;
      return { status: 401 };
    });
    await expect(authApi.login('a@b.com', 'wrong')).rejects.toBeDefined();
    expect(refreshCalls).toBe(0);
  });
});

describe('getErrorMessage', () => {
  const apiError = (status: number | null, data?: unknown) =>
    new AxiosError('x', String(status), undefined, {}, status ? ({ status, data } as never) : undefined);

  it('joins validation messages sent as a list', () => {
    expect(getErrorMessage(apiError(400, { message: ['email must be an email', 'password too short'] }))).toBe(
      'email must be an email, password too short',
    );
  });
  it('uses a plain message from the server', () => {
    expect(getErrorMessage(apiError(409, { message: 'Email already registered' }))).toBe('Email already registered');
  });
  it('explains a missing connection and the rate limit', () => {
    expect(getErrorMessage(apiError(null))).toContain('Cannot reach');
    expect(getErrorMessage(apiError(429, {}))).toContain('Too many requests');
  });
  it('has a safe fallback for unknown errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});
