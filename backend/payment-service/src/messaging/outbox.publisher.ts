import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEnvelope } from './events';
import { RabbitMqService } from './rabbitmq.service';

// Reads unpublished rows from the outbox table and sends them to RabbitMQ.
// Delivery is "at least once": a crash between publish and update means the event is sent again,
// which is safe because every consumer is idempotent.
@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMqService,
  ) {}

  onModuleInit() {
    const every = Number(process.env.OUTBOX_POLL_MS ?? 1000);
    this.timer = setInterval(() => void this.tick(), every);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const rows = await this.prisma.outboxEvent.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const row of rows) {
        try {
          await this.rabbit.publish(row.routingKey, row.payload as unknown as EventEnvelope);
          await this.prisma.outboxEvent.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
          sent++;
        } catch (e) {
          await this.prisma.outboxEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
          console.error(JSON.stringify({ level: 'error', msg: 'outbox publish failed', eventId: row.id, error: String(e) }));
          break; // keep the order: do not publish later events before this one
        }
      }
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', msg: 'outbox tick failed', error: String(e) }));
    } finally {
      this.running = false;
    }
    return sent;
  }
}
