import { InsufficientCapacityError } from './reservation.service';
import { InventorySaga } from './inventory.saga';

describe('InventorySaga', () => {
  let tx: any;
  let prisma: any;
  let reservations: { reserve: jest.Mock; confirm: jest.Mock; release: jest.Mock };
  let saga: InventorySaga;
  const created = (eventId = 'e1') => ({
    eventId, type: 'OrderCreated' as const, version: 1, occurredAt: '', correlationId: 'corr',
    data: { orderId: 'o1', userId: 'u1', items: [], deliveryDate: '2026-12-01', deliverySlot: '10:00-12:00', totalAmount: '1.00', currency: 'INR' },
  });

  beforeEach(() => {
    tx = { processedEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() }, outboxEvent: { create: jest.fn() } };
    prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    reservations = { reserve: jest.fn(), confirm: jest.fn(), release: jest.fn() };
    saga = new InventorySaga(prisma, { registerConsumer: jest.fn() } as any, reservations as any);
  });

  const published = () => tx.outboxEvent.create.mock.calls.map((c: any) => c[0].data.type);

  it('publishes StockReserved after a successful reservation', async () => {
    reservations.reserve.mockResolvedValue({ status: 'RESERVED' });
    await saga.handle(created());
    expect(published()).toEqual(['StockReserved']);
  });

  it('publishes nothing when the order was already cancelled (reservation RELEASED)', async () => {
    reservations.reserve.mockResolvedValue({ status: 'RELEASED' });
    await saga.handle(created());
    expect(published()).toEqual([]);
  });

  it('publishes StockReservationFailed with the reason on a business failure', async () => {
    reservations.reserve.mockRejectedValue(new InsufficientCapacityError('OUT_OF_STOCK'));
    await saga.handle(created());
    const ev = tx.outboxEvent.create.mock.calls[0][0].data;
    expect(ev.type).toBe('StockReservationFailed');
    expect(ev.payload.data).toEqual({ orderId: 'o1', reason: 'OUT_OF_STOCK' });
  });

  it('rethrows technical errors so the message goes to the retry queue', async () => {
    reservations.reserve.mockRejectedValue(new Error('deadlock'));
    await expect(saga.handle(created())).rejects.toThrow('deadlock');
  });

  it('ignores a duplicate delivery of the same event', async () => {
    tx.processedEvent.findUnique.mockResolvedValue({ eventId: 'e1' });
    await saga.handle(created());
    expect(reservations.reserve).not.toHaveBeenCalled();
    expect(published()).toEqual([]);
  });

  it('confirms the reservation on OrderConfirmed', async () => {
    await saga.handle({ eventId: 'e2', type: 'OrderConfirmed', version: 1, occurredAt: '', correlationId: 'c', data: { orderId: 'o1', userId: 'u1' } });
    expect(reservations.confirm).toHaveBeenCalledWith(tx, 'o1');
  });

  it('releases on OrderCancelled and publishes StockReleased only when something was released', async () => {
    const cancelled = (id: string) => ({ eventId: id, type: 'OrderCancelled' as const, version: 1, occurredAt: '', correlationId: 'c', data: { orderId: 'o1', userId: 'u1', reason: 'PAYMENT_FAILED' } });
    reservations.release.mockResolvedValueOnce({ released: true }).mockResolvedValueOnce({ released: false });
    await saga.handle(cancelled('e3'));
    await saga.handle(cancelled('e4'));
    expect(published()).toEqual(['StockReleased']);
  });
});
