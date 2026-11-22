import { InsufficientCapacityError, ReservationService } from './reservation.service';

describe('ReservationService', () => {
  const config = { get: (k: string) => ({ SLOTS: '10:00-12:00,12:00-14:00', DEFAULT_SLOT_CAPACITY: 10 } as any)[k] } as any;
  const service = new ReservationService(config);
  const V1 = '11111111-1111-1111-1111-111111111111';
  const V2 = '22222222-2222-2222-2222-222222222222';
  const data = (over: Record<string, unknown> = {}) => ({
    orderId: 'o1', userId: 'u1', deliveryDate: '2026-12-01', deliverySlot: '10:00-12:00',
    totalAmount: '1000.00', currency: 'INR', items: [{ variantId: V1, quantity: 2 }], ...over,
  });
  let tx: any;

  beforeEach(() => {
    tx = {
      reservation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data })), update: jest.fn() },
      slotCapacity: { createMany: jest.fn() },
      inventoryItem: { findUnique: jest.fn().mockResolvedValue(null) },
      stockMovement: { create: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
  });

  describe('reserve', () => {
    it('is idempotent: returns the existing reservation without touching stock', async () => {
      tx.reservation.findUnique.mockResolvedValue({ id: 'r0', status: 'RESERVED' });
      const r = await service.reserve(tx, data());
      expect(r.id).toBe('r0');
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });

    it('rejects a slot that is not configured', async () => {
      await expect(service.reserve(tx, data({ deliverySlot: '23:00-24:00' }))).rejects.toMatchObject({ reason: 'INVALID_SLOT' });
    });

    it('fails with DELIVERY_SLOT_FULL when the slot has no capacity left', async () => {
      tx.$executeRaw.mockResolvedValueOnce(0);
      await expect(service.reserve(tx, data())).rejects.toBeInstanceOf(InsufficientCapacityError);
      await expect(service.reserve(tx, data())).rejects.toMatchObject({ reason: 'DELIVERY_SLOT_FULL' });
    });

    it('treats a variant without a stock record as made-to-order (no stock update)', async () => {
      const r = await service.reserve(tx, data());
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // only the slot update
      expect(r.status).toBe('RESERVED');
      expect(r.items.create[0]).toMatchObject({ variantId: V1, quantity: 2, tracked: false });
    });

    it('reserves ready-made stock and records a movement', async () => {
      tx.inventoryItem.findUnique.mockResolvedValue({ variantId: V1, onHand: 5, reserved: 0 });
      const r = await service.reserve(tx, data());
      expect(tx.$executeRaw).toHaveBeenCalledTimes(2); // slot + stock
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: { variantId: V1, reservedDelta: 2, reason: 'ORDER_RESERVED', orderId: 'o1' },
      });
      expect(r.items.create[0].tracked).toBe(true);
    });

    it('fails with OUT_OF_STOCK when the conditional stock update changes no row', async () => {
      tx.inventoryItem.findUnique.mockResolvedValue({ variantId: V1, onHand: 1, reserved: 0 });
      tx.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      await expect(service.reserve(tx, data())).rejects.toMatchObject({ reason: 'OUT_OF_STOCK' });
      expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('processes items in a fixed order to avoid deadlocks', async () => {
      tx.inventoryItem.findUnique.mockResolvedValue({ onHand: 9, reserved: 0 });
      await service.reserve(tx, data({ items: [{ variantId: V2, quantity: 1 }, { variantId: V1, quantity: 1 }] }));
      const order = tx.inventoryItem.findUnique.mock.calls.map((c: any) => c[0].where.variantId);
      expect(order).toEqual([V1, V2]);
    });
  });

  describe('confirm', () => {
    it('consumes reserved stock and marks the reservation CONFIRMED', async () => {
      tx.reservation.findUnique.mockResolvedValue({ id: 'r1', status: 'RESERVED', items: [{ variantId: V1, quantity: 2, tracked: true }] });
      expect(await service.confirm(tx, 'o1')).toBe(true);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.reservation.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'CONFIRMED' } });
    });

    it('does nothing when the reservation is not RESERVED', async () => {
      tx.reservation.findUnique.mockResolvedValue({ id: 'r1', status: 'RELEASED', items: [] });
      expect(await service.confirm(tx, 'o1')).toBe(false);
      expect(tx.reservation.update).not.toHaveBeenCalled();
    });
  });

  describe('release (compensation)', () => {
    it('returns reserved stock and slot capacity', async () => {
      tx.reservation.findUnique.mockResolvedValue({
        id: 'r1', status: 'RESERVED', slot: '10:00-12:00', deliveryDate: new Date('2026-12-01'),
        items: [{ variantId: V1, quantity: 2, tracked: true }],
      });
      expect(await service.release(tx, 'o1')).toEqual({ released: true });
      expect(tx.$executeRaw).toHaveBeenCalledTimes(2); // stock + slot
      expect(tx.reservation.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'RELEASED' } });
    });

    it('is idempotent: releasing twice changes nothing the second time', async () => {
      tx.reservation.findUnique.mockResolvedValue({ id: 'r1', status: 'RELEASED', items: [] });
      expect(await service.release(tx, 'o1')).toEqual({ released: false });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });

    it('leaves a RELEASED marker when the cancellation arrives before the reservation', async () => {
      tx.reservation.findUnique.mockResolvedValue(null);
      expect(await service.release(tx, 'o1')).toEqual({ released: false });
      expect(tx.reservation.create.mock.calls[0][0].data).toMatchObject({ orderId: 'o1', status: 'RELEASED' });
    });
  });
});
