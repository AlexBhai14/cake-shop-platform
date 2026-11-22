// Load test with k6 (https://k6.io). It browses the shop like many visitors and checks the cart of one logged-in user.
//
// IMPORTANT: the gateway limits requests per IP address (default: 120 per minute for anonymous users).
// Before the test raise the limits in backend/api-gateway/.env and restart the gateway:
//   RATE_PUBLIC_LIMIT=100000   RATE_USER_LIMIT=100000   RATE_AUTH_LIMIT=1000   RATE_LOGIN_LIMIT=1000
//
// Run (PowerShell, from the project root):
//   Get-Content tests\performance\load-test.js | docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 grafana/k6 run -
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // less than 1 % errors
    http_req_duration: ['p(95)<500'], // 95 % of requests faster than 500 ms
  },
};

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:3000';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Runs once: one customer is registered and logged in, the token is shared by all virtual users
export function setup() {
  const email = `k6.${Date.now()}@example.com`;
  const password = 'Password123';
  http.post(`${BASE}/api/auth/register`, JSON.stringify({ email, password }), { headers: JSON_HEADERS });
  const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password }), { headers: JSON_HEADERS });
  check(login, { 'setup login works': (r) => r.status === 200 });
  return { token: login.json('accessToken') };
}

export default function (data) {
  const list = http.get(`${BASE}/api/cakes?limit=12`);
  check(list, { 'cake list is 200': (r) => r.status === 200 });

  const categories = http.get(`${BASE}/api/categories`);
  check(categories, { 'categories are 200': (r) => r.status === 200 });

  const search = http.get(`${BASE}/api/cakes?search=chocolate`);
  check(search, { 'search is 200': (r) => r.status === 200 });

  const cake = list.json('items.0.id');
  if (cake) {
    const detail = http.get(`${BASE}/api/cakes/${cake}`);
    check(detail, { 'cake detail is 200': (r) => r.status === 200 });
  }

  const cart = http.get(`${BASE}/api/cart`, { headers: { Authorization: `Bearer ${data.token}` } });
  check(cart, { 'cart is 200': (r) => r.status === 200 });

  sleep(1);
}
