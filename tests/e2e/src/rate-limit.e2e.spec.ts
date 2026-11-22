import { api, uniqueEmail } from './helpers';

// Run this file ALONE with the DEFAULT gateway limits (login: 5 per minute per IP):
//   npm run test:ratelimit
// If you raised the limits for the other tests, set E2E_LOGIN_LIMIT to the same number.
const LIMIT = Number(process.env.E2E_LOGIN_LIMIT ?? 5);

describe('Rate limiting at the gateway (Redis)', () => {
  it(`too many login attempts from one IP get HTTP 429 with Retry-After (limit ${LIMIT} per minute)`, async () => {
    const statuses: number[] = [];
    let limited: { headers: Record<string, string>; body: { statusCode?: number } } | undefined;
    for (let i = 0; i < LIMIT + 3; i++) {
      const res = await api().post('/api/auth/login').send({ email: uniqueEmail('limit'), password: 'WrongPassword1' });
      statuses.push(res.status);
      if (res.status === 429 && !limited) limited = { headers: res.headers as Record<string, string>, body: res.body };
    }
    expect(statuses).toContain(401); // wrong password attempts are answered normally at first...
    expect(statuses).toContain(429); // ...then the limit blocks them
    expect(statuses.indexOf(429)).toBeLessThanOrEqual(LIMIT);
    expect(Number(limited!.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited!.body.statusCode).toBe(429);
  });

  it('browsing is not affected by the strict login limit', async () => {
    expect((await api().get('/api/cakes')).status).toBe(200);
  });
});
