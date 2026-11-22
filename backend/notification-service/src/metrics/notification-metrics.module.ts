import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class NotificationGauge implements OnModuleInit {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.metrics.addGauge('notifications_pending', 'Emails waiting to be sent', () =>
      this.prisma.notification.count({ where: { status: 'PENDING' } }),
    );
    this.metrics.addGauge('notifications_failed', 'Emails that failed after all retries', () =>
      this.prisma.notification.count({ where: { status: 'FAILED' } }),
    );
  }
}

@Module({ providers: [NotificationGauge] })
export class NotificationMetricsModule {}
