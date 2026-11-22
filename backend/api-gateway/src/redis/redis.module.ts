import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          // Fail fast instead of queueing commands while Redis is down
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (times: number) => Math.min(times * 200, 2000),
        });
        client.on('error', (e: Error) =>
          console.error(JSON.stringify({ level: 'error', service: 'api-gateway', msg: 'redis error', error: e.message })),
        );
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
