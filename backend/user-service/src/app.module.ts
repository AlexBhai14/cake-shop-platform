import { MetricsModule } from './metrics/metrics.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [MetricsModule, ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SecurityModule, UsersModule],
  controllers: [HealthController],
})
export class AppModule {}
