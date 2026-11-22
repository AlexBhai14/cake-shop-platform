import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseDate, ReservationService } from './reservation.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationService,
  ) {}

  async listItems(page = 1, limit = 20) {
    const [rows, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({ orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.inventoryItem.count(),
    ]);
    return { items: rows.map((r) => ({ ...r, available: r.onHand - r.reserved })), total, page, limit };
  }

  async setStock(variantId: string, onHand: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({ where: { variantId } });
      if (existing && onHand < existing.reserved) {
        throw new BadRequestException(`Cannot go below the reserved quantity (${existing.reserved})`);
      }
      const item = await tx.inventoryItem.upsert({
        where: { variantId },
        update: { onHand },
        create: { variantId, onHand },
      });
      await tx.stockMovement.create({
        data: { variantId, onHandDelta: onHand - (existing?.onHand ?? 0), reason: 'MANUAL_SET' },
      });
      return { ...item, available: item.onHand - item.reserved };
    });
  }

  async adjust(variantId: string, delta: number, reason: string) {
    if (delta === 0) throw new BadRequestException('delta must not be 0');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { variantId } });
      if (!item) throw new NotFoundException('No stock record for this variant. Use PUT to create one.');
      // Conditional update: never let onHand drop below what is already reserved
      const rows = await tx.$executeRaw`UPDATE inventory_items SET onHand = onHand + ${delta} WHERE variantId = ${variantId} AND onHand + ${delta} >= reserved`;
      if (rows === 0) throw new BadRequestException('Adjustment would drop stock below the reserved quantity');
      await tx.stockMovement.create({ data: { variantId, onHandDelta: delta, reason: `ADJUSTMENT: ${reason}` } });
      const updated = await tx.inventoryItem.findUnique({ where: { variantId } });
      return { ...updated!, available: updated!.onHand - updated!.reserved };
    });
  }

  history(variantId: string, limit = 50) {
    return this.prisma.stockMovement.findMany({ where: { variantId }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  // Availability of every configured slot on a date (used by the checkout page)
  async getSlots(date: string) {
    const rows = await this.prisma.slotCapacity.findMany({ where: { deliveryDate: parseDate(date) } });
    return this.reservations.slots.map((slot) => {
      const row = rows.find((r) => r.slot === slot);
      const capacity = row?.capacity ?? this.reservations.defaultCapacity;
      const booked = row?.booked ?? 0;
      return { date, slot, capacity, booked, available: Math.max(0, capacity - booked) };
    });
  }

  async setSlotCapacity(date: string, slot: string, capacity: number) {
    if (!this.reservations.slots.includes(slot)) {
      throw new BadRequestException(`Unknown slot. Allowed: ${this.reservations.slots.join(', ')}`);
    }
    const deliveryDate = parseDate(date);
    const existing = await this.prisma.slotCapacity.findUnique({
      where: { deliveryDate_slot: { deliveryDate, slot } },
    });
    if (existing && capacity < existing.booked) {
      throw new BadRequestException(`Capacity cannot be below the already booked quantity (${existing.booked})`);
    }
    return this.prisma.slotCapacity.upsert({
      where: { deliveryDate_slot: { deliveryDate, slot } },
      update: { capacity },
      create: { deliveryDate, slot, capacity },
    });
  }
}
