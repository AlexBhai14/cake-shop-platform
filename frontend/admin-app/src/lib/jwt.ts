export interface SessionUser {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

interface Payload {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
}

// Reads the payload of a JWT. This is for DISPLAY only (name in the header, which menu to show).
// It does NOT prove anything: the backend verifies the signature on every request.
export function decodeJwt(token: string): Payload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Payload;
  } catch {
    return null;
  }
}

export function userFromToken(token: string): SessionUser | null {
  const p = decodeJwt(token);
  if (!p?.sub || !p.email || (p.role !== 'CUSTOMER' && p.role !== 'ADMIN')) return null;
  return { userId: p.sub, email: p.email, role: p.role };
}
