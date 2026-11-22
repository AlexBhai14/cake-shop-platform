import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  @Get()
  live() {
    return { status: 'ok', service: 'api-gateway' };
  }

  // The gateway can still route traffic when Redis is down (rate limiting fails open),
  // but "ready" reports it so monitoring can alert.
  @Get('ready')
  async ready() {
    try {
      await this.redis.ping();
      return { status: 'ready', redis: 'up' };
    } catch {
      throw new ServiceUnavailableException('redis not reachable');
    }
  }
}
