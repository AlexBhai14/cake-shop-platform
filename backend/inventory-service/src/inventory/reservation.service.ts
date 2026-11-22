import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderCreatedData } from '../messaging/events';

export type FailureReason = 'DELIVERY_SLOT_FULL' | 'OUT_OF_STOCK' | 'INVALID_SLOT';

export class InsufficientCapacityError extends Error {
  constructor(public readonly reason: FailureReason) {
    super(reason);
  }
}

export const DEFAULT_SLOTS = '10:00-12:00,12:00-14:00,14:00-16:00,16:00-18:00';
export const parseDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

// All methods run INSIDE a database transaction (tx) opened by the caller.
// Overselling is prevented by conditional UPDATE statements: MySQL locks the row, so two
// checkouts at the same moment are processed one after the other and the second one fails cleanly.
@Injectable()
export class ReservationService {
  constructor(private readonly config: ConfigService) {}

  get slots(): string[] {
    return (this.config.get<string>('SLOTS') ?? DEFAULT_SLOTS).split(',').map((s) => s.trim()).filter(Boolean);
  }

  get defaultCapacity(): number {
    return Number(this.config.get('DEFAULT_SLOT_CAPACITY') ?? 10);
  }

  async reserve(tx: any, data: OrderCreatedData) {
    // Idempotent per order: a second attempt returns the first reservation.
    const existing = await tx.reservation.findUnique({ where: { orderId: data.orderId } });
    if (existing) return existing;

    if (!this.slots.includes(data.deliverySlot)) throw new InsufficientCapacityError('INVALID_SLOT');

    const date = parseDate(data.deliveryDate);
    const units = data.items.reduce((sum, i) => sum + i.quantity, 0);

    // 1. Delivery-slot capacity (created lazily with the default capacity)
    await tx.slotCapacity.createMany({
      data: [{ deliveryDate: date, slot: data.deliverySlot, capacity: this.defaultCapacity }],
      skipDuplicates: true,
    });
    const slotRows = await tx.$executeRaw`UPDATE slot_capacities SET booked = booked + ${units} WHERE deliveryDate = ${date} AND slot = ${data.deliverySlot} AND capacity - booked >= ${units}`;
    if (slotRows === 0) throw new InsufficientCapacityError('DELIVERY_SLOT_FULL');

    // 2. Ready-made stock. Items are processed in a fixed order to avoid deadlocks.
    const items: Array<{ variantId: string; quantity: number; tracked: boolean }> = [];
    const sorted = [...data.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const item of sorted) {
      const stock = await tx.inventoryItem.findUnique({ where: { variantId: item.variantId } });
      if (!stock) {
        items.push({ variantId: item.variantId, quantity: item.quantity, tracked: false }); // made to order
        continue;
      }
      const rows = await tx.$executeRaw`UPDATE inventory_items SET reserved = reserved + ${item.quantity} WHERE variantId = ${item.variantId} AND onHand - reserved >= ${item.quantity}`;
      if (rows === 0) throw new InsufficientCapacityError('OUT_OF_STOCK');
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          reservedDelta: item.quantity,
          reason: 'ORDER_RESERVED',
          orderId: data.orderId,
        },
      });
      items.push({ variantId: item.variantId, quantity: item.quantity, tracked: true });
    }

    return tx.reservation.create({
      data: { orderId: data.orderId, status: 'RESERVED', deliveryDate: date, slot: data.deliverySlot, items: { create: items } },
      include: { items: true },
    });
  }

  // Payment succeeded: the reserved stock is really consumed.
  async confirm(tx: any, orderId: string): Promise<boolean> {
    const r = await tx.reservation.findUnique({ where: { orderId }, include: { items: true } });
    if (!r || r.status !== 'RESERVED') return false;
    for (const item of r.items.filter((i: any) => i.tracked)) {
      await tx.$executeRaw`UPDATE inventory_items SET onHand = onHand - ${item.quantity}, reserved = reserved - ${item.quantity} WHERE variantId = ${item.variantId}`;
      await tx.stockMovement.create({
        data: { variantId: item.variantId, onHandDelta: -item.quantity, reservedDelta: -item.quantity, reason: 'ORDER_CONFIRMED', orderId },
      });
    }
    await tx.reservation.update({ where: { id: r.id }, data: { status: 'CONFIRMED' } });
    return true;
  }

  // Compensating action of the saga: give stock and slot capacity back.
  async release(tx: any, orderId: string): Promise<{ released: boolean }> {
    const r = await tx.reservation.findUnique({ where: { orderId }, include: { items: true } });
    if (!r) {
      // The cancellation arrived before the reservation. Leave a "RELEASED" marker so that a late
      // OrderCreated for this order can never reserve anything.
      await tx.reservation.create({
        data: { orderId, status: 'RELEASED', deliveryDate: parseDate('1970-01-01'), slot: 'none' },
      });
      return { released: false };
    }
    if (r.status === 'RELEASED') return { released: false };

    const units = r.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
    for (const item of r.items.filter((i: any) => i.tracked)) {
      if (r.status === 'RESERVED') {
        await tx.$executeRaw`UPDATE inventory_items SET reserved = reserved - ${item.quantity} WHERE variantId = ${item.variantId}`;
        await tx.stockMovement.create({
          data: { variantId: item.variantId, reservedDelta: -item.quantity, reason: 'ORDER_RELEASED', orderId },
        });
      } else {
        // The order had already been confirmed, so the stock was consumed: put it back.
        await tx.$executeRaw`UPDATE inventory_items SET onHand = onHand + ${item.quantity} WHERE variantId = ${item.variantId}`;
        await tx.stockMovement.create({
          data: { variantId: item.variantId, onHandDelta: item.quantity, reason: 'ORDER_CANCELLED_AFTER_CONFIRM', orderId },
        });
      }
    }
    if (r.slot !== 'none' && units > 0) {
      await tx.$executeRaw`UPDATE slot_capacities SET booked = booked - ${units} WHERE deliveryDate = ${r.deliveryDate} AND slot = ${r.slot} AND booked >= ${units}`;
    }
    await tx.reservation.update({ where: { id: r.id }, data: { status: 'RELEASED' } });
    return { released: true };
  }
}
