import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  const subject = { policy: 'login' as const, id: '1.2.3.4' }; // default: 5 per 60s
  let redis: { eval: jest.Mock };
  let service: RateLimitService;

  beforeEach(() => {
    redis = { eval: jest.fn() };
    service = new RateLimitService(redis as any);
  });

  it('allows requests up to the limit', async () => {
    redis.eval.mockResolvedValue([5, 42000]);
    const r = await service.check(subject);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
    expect(r.limit).toBe(5);
  });

  it('blocks the request after the limit and reports Retry-After', async () => {
    redis.eval.mockResolvedValue([6, 41200]);
    const r = await service.check(subject);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSec).toBe(42);
  });

  it('uses a key that contains the policy and the subject id', async () => {
    redis.eval.mockResolvedValue([1, 60000]);
    await service.check(subject);
    expect(redis.eval.mock.calls[0][2]).toBe('rl:login:1.2.3.4');
    expect(redis.eval.mock.calls[0][3]).toBe(60000);
  });

  it('fails open (allows the request) when Redis is unreachable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    redis.eval.mockRejectedValue(new Error('connection refused'));
    const r = await service.check(subject);
    expect(r.allowed).toBe(true);
    expect(r.degraded).toBe(true);
  });
});
