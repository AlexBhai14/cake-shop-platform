import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { loadPolicies, Policy, Subject } from './rate-limit.config';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  degraded: boolean; // true when Redis was unreachable and the request was let through
}

// Fixed-window counter, done atomically inside Redis (one round trip, no race conditions).
const SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {c, ttl}
`;

@Injectable()
export class RateLimitService {
  private readonly policies: Record<string, Policy>;

  constructor(@Inject(REDIS) private readonly redis: Redis) {
    this.policies = loadPolicies(process.env);
  }

  async check(subject: Subject): Promise<RateLimitResult> {
    const policy = this.policies[subject.policy];
    const key = `rl:${policy.name}:${subject.id}`;
    try {
      const [count, ttlMs] = (await this.redis.eval(SCRIPT, 1, key, policy.windowSec * 1000)) as [number, number];
      return {
        allowed: count <= policy.limit,
        limit: policy.limit,
        remaining: Math.max(0, policy.limit - count),
        retryAfterSec: Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000)),
        degraded: false,
      };
    } catch (e) {
      // Fail open: if Redis is down the shop stays available (the error is logged).
      console.error(
        JSON.stringify({ level: 'error', service: 'api-gateway', msg: 'rate limiter degraded', error: String(e) }),
      );
      return { allowed: true, limit: policy.limit, remaining: policy.limit, retryAfterSec: 0, degraded: true };
    }
  }
}
