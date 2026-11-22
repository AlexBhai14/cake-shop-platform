import { MetricsModule } from './metrics/metrics.module';
import { OutboxMetricsModule } from './metrics/outbox-metrics.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { MessagingModule } from './messaging/messaging.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [MetricsModule, OutboxMetricsModule, ConfigModule.forRoot({ isGlobal: true }), PrismaModule, MessagingModule, SecurityModule, PaymentsModule],
  controllers: [HealthController],
})
export class AppModule {}
