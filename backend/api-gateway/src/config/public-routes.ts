// Routes that work WITHOUT a token. Everything else needs a valid access token.
// (Each microservice still checks the token and the role again: defence in depth.)
const PUBLIC: Array<{ method: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^\/api\/auth\/(register|login|refresh|logout)$/ },
  { method: 'GET', pattern: /^\/api\/categories$/ },
  { method: 'GET', pattern: /^\/api\/cakes$/ },
  { method: 'GET', pattern: /^\/api\/cakes\/[^/]+$/ },
  { method: 'GET', pattern: /^\/api\/variants\/[^/]+$/ },
];

export function isPublicRoute(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  return PUBLIC.some((r) => r.method === m && r.pattern.test(pathname));
}
