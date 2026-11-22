import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEnvelope, OrderCreatedData, ROUTING_KEYS } from '../messaging/events';
import { enqueueEvent, processOnce } from '../messaging/idempotency';
import { RabbitMqService } from '../messaging/rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientCapacityError, ReservationService } from './reservation.service';

// Inventory's part of the checkout saga.
//   OrderCreated   -> reserve stock + slot  -> StockReserved  or  StockReservationFailed
//   OrderConfirmed -> consume the reservation
//   OrderCancelled -> release the reservation (compensation)  -> StockReleased
@Injectable()
export class InventorySaga implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMqService,
    private readonly reservations: ReservationService,
  ) {}

  onModuleInit() {
    this.rabbit.registerConsumer({
      queue: 'inventory.events',
      bindings: [ROUTING_KEYS.OrderCreated, ROUTING_KEYS.OrderConfirmed, ROUTING_KEYS.OrderCancelled],
      handler: (event) => this.handle(event),
    });
  }

  async handle(event: EventEnvelope): Promise<void> {
    switch (event.type) {
      case 'OrderCreated':
        return this.onOrderCreated(event as EventEnvelope<OrderCreatedData>);
      case 'OrderConfirmed':
        return this.onOrderConfirmed(event);
      case 'OrderCancelled':
        return this.onOrderCancelled(event);
      default:
        return; // events this service does not care about
    }
  }

  async onOrderCreated(event: EventEnvelope<OrderCreatedData>) {
    const { orderId } = event.data;
    try {
      await processOnce(this.prisma, event.eventId, async (tx) => {
        const reservation = await this.reservations.reserve(tx, event.data);
        if (reservation.status === 'RESERVED') {
          await enqueueEvent(tx, 'StockReserved', { orderId }, event.correlationId);
        }
      });
    } catch (e) {
      if (!(e instanceof InsufficientCapacityError)) throw e; // technical error -> retry queue
      // Business failure: the transaction above was rolled back, so record the failure separately.
      await processOnce(this.prisma, event.eventId, async (tx) => {
        await enqueueEvent(tx, 'StockReservationFailed', { orderId, reason: e.reason }, event.correlationId);
      });
    }
  }

  async onOrderConfirmed(event: EventEnvelope) {
    await processOnce(this.prisma, event.eventId, (tx) => this.reservations.confirm(tx, event.data.orderId));
  }

  async onOrderCancelled(event: EventEnvelope) {
    await processOnce(this.prisma, event.eventId, async (tx) => {
      const { released } = await this.reservations.release(tx, event.data.orderId);
      if (released) await enqueueEvent(tx, 'StockReleased', { orderId: event.data.orderId }, event.correlationId);
    });
  }
}
