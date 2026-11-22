import { MetricsModule } from './metrics/metrics.module';
import { NotificationMetricsModule } from './metrics/notification-metrics.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [MetricsModule, NotificationMetricsModule, ConfigModule.forRoot({ isGlobal: true }), PrismaModule, MessagingModule, SecurityModule, NotificationsModule],
  controllers: [HealthController],
})
export class AppModule {}
