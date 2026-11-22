import { MetricsModule } from './metrics/metrics.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './auth/token.service';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { GatewayController } from './gateway/gateway.controller';
import { HealthController } from './health/health.controller';
import { ProxyService } from './proxy/proxy.service';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [MetricsModule, 
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_ACCESS_SECRET') }),
    }),
  ],
  // HealthController first: /health must never be treated as a proxied route
  controllers: [HealthController, GatewayController],
  providers: [TokenService, RateLimitService, ProxyService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
