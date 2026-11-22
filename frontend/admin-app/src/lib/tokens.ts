// The access token lives only in memory (gone on page reload).
// The refresh token is kept in localStorage so the user stays logged in after a reload.
// Trade-off: localStorage can be read by injected scripts (XSS). A production shop would put the
// refresh token in an httpOnly cookie. This project documents the trade-off instead of hiding it.
const REFRESH_KEY = 'cake.refreshToken';
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  try {
    localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* storage not available */
  }
}

export function clearTokens() {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage not available */
  }
}
