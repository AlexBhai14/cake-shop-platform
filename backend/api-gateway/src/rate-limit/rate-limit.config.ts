export type PolicyName = 'login' | 'auth' | 'public' | 'user' | 'admin';

export interface Policy {
  name: PolicyName;
  limit: number;
  windowSec: number;
}

export interface Subject {
  policy: PolicyName;
  id: string; // an IP address or a user id
}

// [limit, windowSec] used when the environment variable is missing
const DEFAULTS: Record<PolicyName, [number, number]> = {
  login: [5, 60],
  auth: [10, 60],
  public: [120, 60],
  user: [100, 60],
  admin: [60, 60],
};

export function loadPolicies(env: Record<string, string | undefined>): Record<PolicyName, Policy> {
  const out = {} as Record<PolicyName, Policy>;
  (Object.keys(DEFAULTS) as PolicyName[]).forEach((name) => {
    const key = name.toUpperCase();
    out[name] = {
      name,
      limit: Number(env[`RATE_${key}_LIMIT`]) || DEFAULTS[name][0],
      windowSec: Number(env[`RATE_${key}_WINDOW_SEC`]) || DEFAULTS[name][1],
    };
  });
  return out;
}

// Decides WHICH policy applies and WHO is being counted (IP-based or user-based).
export function selectSubject(
  pathname: string,
  user: { userId: string; role: string } | null,
  ip: string,
): Subject {
  if (pathname === '/api/auth/login') return { policy: 'login', id: ip };
  // Only the public auth endpoints get the strict IP-based policy. /api/auth/me and the admin routes
  // belong to a logged-in user and use the normal user/admin policy.
  if (/^\/api\/auth\/(register|refresh|logout)$/.test(pathname)) return { policy: 'auth', id: ip };
  if (user?.role === 'ADMIN') return { policy: 'admin', id: user.userId };
  if (user) return { policy: 'user', id: user.userId };
  return { policy: 'public', id: ip };
}
