import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEnvelope, ROUTING_KEYS } from '../messaging/events';
import { processOnce } from '../messaging/idempotency';
import { RabbitMqService } from '../messaging/rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailKind, isNotifiableStatus, renderEmail } from './templates';

interface Plan {
  kind: EmailKind;
  orderId: string;
  userId?: string;
  email?: string;
  status?: string;
  reason?: string;
  amount?: string;
}

// Turns business events into saved notifications. Sending happens later (EmailDispatcher).
@Injectable()
export class NotificationsSaga implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMqService,
  ) {}

  onModuleInit() {
    this.rabbit.registerConsumer({
      queue: 'notification.events',
      bindings: [
        ROUTING_KEYS.OrderConfirmed,
        ROUTING_KEYS.OrderCancelled,
        ROUTING_KEYS.OrderStatusChanged,
        ROUTING_KEYS.OrderShipped,
        ROUTING_KEYS.RefundProcessed,
      ],
      handler: (event) => this.handle(event),
    });
  }

  plan(event: EventEnvelope): Plan | null {
    const d = event.data;
    switch (event.type) {
      case 'OrderConfirmed':
        return { kind: 'ORDER_CONFIRMED', orderId: d.orderId, userId: d.userId, email: d.email };
      case 'OrderCancelled':
        return { kind: 'ORDER_CANCELLED', orderId: d.orderId, userId: d.userId, email: d.email, reason: d.reason };
      case 'OrderStatusChanged':
        return isNotifiableStatus(d.status)
          ? { kind: 'ORDER_STATUS', orderId: d.orderId, userId: d.userId, email: d.email, status: d.status }
          : null;
      case 'OrderShipped':
        return { kind: 'ORDER_SHIPPED', orderId: d.orderId, userId: d.userId, email: d.email };
      case 'RefundProcessed':
        return { kind: 'REFUND_PROCESSED', orderId: d.orderId, userId: d.userId, email: d.email, amount: d.amount };
      default:
        return null;
    }
  }

  async handle(event: EventEnvelope): Promise<void> {
    const plan = this.plan(event);
    if (!plan) return;
    if (!plan.email) {
      console.log(JSON.stringify({ level: 'warn', service: 'notification-service', msg: 'no email address in event, skipped', eventId: event.eventId }));
      return;
    }
    const toEmail: string = plan.email;
    const mail = renderEmail(plan.kind, { orderId: plan.orderId, status: plan.status, reason: plan.reason, amount: plan.amount });
    await processOnce(this.prisma, event.eventId, async (tx) => {
      await tx.notification.create({
        data: {
          eventId: event.eventId,
          userId: plan.userId ?? null,
          orderId: plan.orderId,
          type: plan.kind,
          toEmail,
          subject: mail.subject,
          bodyText: mail.text,
          bodyHtml: mail.html,
        },
      });
    });
  }
}
