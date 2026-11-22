import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

// How many events wait in the outbox table. A number that keeps growing means RabbitMQ is unreachable
// or the publisher is stuck: the saga is not moving.
@Injectable()
export class OutboxGauge implements OnModuleInit {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.metrics.addGauge(
      'outbox_pending_events',
      'Events saved in the outbox that are not yet published to RabbitMQ',
      () => this.prisma.outboxEvent.count({ where: { publishedAt: null } }),
    );
  }
}

@Module({ providers: [OutboxGauge] })
export class OutboxMetricsModule {}
