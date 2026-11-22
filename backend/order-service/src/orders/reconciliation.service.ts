import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { enqueueEvent } from '../messaging/idempotency';
import { PrismaService } from '../prisma/prisma.service';
import { applyTransition } from './transition';

// Reconciliation for uncertain outcomes: if no payment result arrives (timeout, lost message),
// the order must not stay PENDING_PAYMENT forever and keep stock reserved.
// If the payment succeeds later anyway, OrderSaga sees a CANCELLED order and requests a refund.
@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.cancelExpired(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async cancelExpired(now: Date = new Date()): Promise<number> {
    const minutes = Number(this.config.get('PAYMENT_TIMEOUT_MINUTES') ?? 15);
    const cutoff = new Date(now.getTime() - minutes * 60_000);
    const expired = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
      take: 50,
    });
    let cancelled = 0;
    for (const order of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await applyTransition(tx, order.id, 'PENDING_PAYMENT', 'CANCELLED', 'system', 'PAYMENT_TIMEOUT', { cancelReason: 'PAYMENT_TIMEOUT' });
          await enqueueEvent(tx, 'OrderCancelled', { orderId: order.id, userId: order.userId, reason: 'PAYMENT_TIMEOUT', email: order.customerEmail ?? undefined }, randomUUID());
        });
        cancelled++;
      } catch (e) {
        // Most likely the order changed in the meantime (payment arrived): leave it alone.
        console.error(JSON.stringify({ level: 'warn', service: 'order-service', msg: 'timeout cancel skipped', orderId: order.id, error: String(e) }));
      }
    }
    return cancelled;
  }
}
