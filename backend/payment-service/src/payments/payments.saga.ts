import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEnvelope, ROUTING_KEYS } from '../messaging/events';
import { processOnce } from '../messaging/idempotency';
import { RabbitMqService } from '../messaging/rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

// Payment's part of the saga.
//   PaymentRequested -> payment record (and automatic mock payment if AUTO_PAY_SCENARIO is set)
//   RefundRequested  -> mock refund
//   OrderCancelled   -> a payment that was never paid is cancelled
//   OrderStatusChanged(DELIVERED) -> the payment is marked as not refundable any more
@Injectable()
export class PaymentsSaga implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMqService,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit() {
    this.rabbit.registerConsumer({
      queue: 'payment.events',
      bindings: [ROUTING_KEYS.PaymentRequested, ROUTING_KEYS.RefundRequested, ROUTING_KEYS.OrderCancelled, ROUTING_KEYS.OrderStatusChanged],
      handler: (event) => this.handle(event),
    });
    // Reconciliation: look at payments whose result is unknown
    this.timer = setInterval(() => void this.payments.reconcile(), 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async handle(event: EventEnvelope): Promise<void> {
    await processOnce(this.prisma, event.eventId, async (tx) => {
      switch (event.type) {
        case 'PaymentRequested':
          await this.payments.createFromRequest(tx, event.data, event.correlationId);
          return;
        case 'RefundRequested':
          await this.payments.refund(tx, event.data.orderId, event.data.reason, event.correlationId);
          return;
        case 'OrderCancelled':
          await this.payments.cancelPending(tx, event.data.orderId);
          return;
        case 'OrderStatusChanged':
          if (event.data.status === 'DELIVERED') await this.payments.markOrderDelivered(tx, event.data.orderId);
          return;
        default:
          return;
      }
    });
  }
}
