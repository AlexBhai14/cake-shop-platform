import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEnvelope, ROUTING_KEYS } from '../messaging/events';
import { enqueueEvent, processOnce } from '../messaging/idempotency';
import { RabbitMqService } from '../messaging/rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { applyTransition } from './transition';

// The Order Service is the saga ORCHESTRATOR of checkout.
//   StockReserved          -> ask for payment (PaymentRequested)
//   StockReservationFailed -> cancel the order
//   PaymentSucceeded       -> CONFIRMED (+ OrderConfirmed), or refund if the order is no longer pending
//   PaymentFailed          -> PAYMENT_FAILED + OrderCancelled (inventory releases the reservation)
@Injectable()
export class OrderSaga implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMqService,
  ) {}

  onModuleInit() {
    this.rabbit.registerConsumer({
      queue: 'order.events',
      bindings: [
        ROUTING_KEYS.StockReserved,
        ROUTING_KEYS.StockReservationFailed,
        ROUTING_KEYS.PaymentSucceeded,
        ROUTING_KEYS.PaymentFailed,
      ],
      handler: (event) => this.handle(event),
    });
  }

  async handle(event: EventEnvelope): Promise<void> {
    await processOnce(this.prisma, event.eventId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: event.data.orderId } });
      if (!order) return; // unknown order: nothing to do
      const pending = order.status === 'PENDING_PAYMENT';
      const corr = event.correlationId;
      const email = order.customerEmail ?? undefined; // lets the notification service send emails

      switch (event.type) {
        case 'StockReserved':
          if (pending) {
            await enqueueEvent(tx, 'PaymentRequested', {
              orderId: order.id,
              userId: order.userId,
              amount: order.totalAmount.toString(),
              currency: order.currency,
              email,
            }, corr);
          }
          return;

        case 'StockReservationFailed':
          if (pending) {
            await applyTransition(tx, order.id, 'PENDING_PAYMENT', 'CANCELLED', 'system', event.data.reason, { cancelReason: event.data.reason });
            await enqueueEvent(tx, 'OrderCancelled', { orderId: order.id, userId: order.userId, reason: event.data.reason, email }, corr);
          }
          return;

        case 'PaymentSucceeded':
          if (pending) {
            await applyTransition(tx, order.id, 'PENDING_PAYMENT', 'CONFIRMED', 'system', 'Payment received', { paymentId: event.data.paymentId });
            await enqueueEvent(tx, 'OrderConfirmed', { orderId: order.id, userId: order.userId, email }, corr);
          } else if (order.status === 'CANCELLED') {
            // Late payment for an order we already cancelled (for example after a timeout): give the money back.
            await tx.order.update({ where: { id: order.id }, data: { paymentId: event.data.paymentId } });
            await enqueueEvent(tx, 'RefundRequested', { orderId: order.id, paymentId: event.data.paymentId, reason: 'PAID_AFTER_CANCELLATION' }, corr);
          }
          return;

        case 'PaymentFailed':
          if (pending) {
            await applyTransition(tx, order.id, 'PENDING_PAYMENT', 'PAYMENT_FAILED', 'system', event.data.reason, { cancelReason: 'PAYMENT_FAILED' });
            await enqueueEvent(tx, 'OrderCancelled', { orderId: order.id, userId: order.userId, reason: 'PAYMENT_FAILED', email }, corr);
          }
          return;

        default:
          return;
      }
    });
  }
}
