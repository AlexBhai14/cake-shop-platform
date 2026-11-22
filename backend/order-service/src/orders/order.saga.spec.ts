import { OrderSaga } from './order.saga';
import { ReconciliationService } from './reconciliation.service';

describe('OrderSaga', () => {
  let tx: any;
  let prisma: any;
  let saga: OrderSaga;
  const order = (status: string) => ({ id: 'o1', userId: 'u1', status, totalAmount: { toString: () => '1847.00' }, currency: 'INR', paymentId: null, customerEmail: 'sahil@example.com' });
  const ev = (type: string, data: Record<string, unknown> = {}, eventId = 'e1') => ({
    eventId, type: type as any, version: 1, occurredAt: '', correlationId: 'corr', data: { orderId: 'o1', ...data },
  });

  beforeEach(() => {
    tx = {
      processedEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      order: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    saga = new OrderSaga(prisma, { registerConsumer: jest.fn() } as any);
  });

  const published = () => tx.outboxEvent.create.mock.calls.map((c: any) => c[0].data.type);
  const statusSet = () => tx.order.updateMany.mock.calls.map((c: any) => c[0].data.status);

  it('StockReserved -> asks for payment with the order total', async () => {
    tx.order.findUnique.mockResolvedValue(order('PENDING_PAYMENT'));
    await saga.handle(ev('StockReserved'));
    expect(published()).toEqual(['PaymentRequested']);
    expect(tx.outboxEvent.create.mock.calls[0][0].data.payload.data).toMatchObject({ orderId: 'o1', amount: '1847.00', currency: 'INR' });
  });

  it('StockReserved for an order that is no longer pending does nothing', async () => {
    tx.order.findUnique.mockResolvedValue(order('CANCELLED'));
    await saga.handle(ev('StockReserved'));
    expect(published()).toEqual([]);
  });

  it('StockReservationFailed -> order CANCELLED with the reason and OrderCancelled published', async () => {
    tx.order.findUnique.mockResolvedValue(order('PENDING_PAYMENT'));
    await saga.handle(ev('StockReservationFailed', { reason: 'DELIVERY_SLOT_FULL' }));
    expect(statusSet()).toEqual(['CANCELLED']);
    expect(tx.outboxEvent.create.mock.calls[0][0].data.payload.data.reason).toBe('DELIVERY_SLOT_FULL');
    expect(published()).toEqual(['OrderCancelled']);
  });

  it('PaymentSucceeded -> CONFIRMED, payment id stored, OrderConfirmed published', async () => {
    tx.order.findUnique.mockResolvedValue(order('PENDING_PAYMENT'));
    await saga.handle(ev('PaymentSucceeded', { paymentId: 'p1' }));
    expect(tx.order.updateMany.mock.calls[0][0].data).toEqual({ status: 'CONFIRMED', paymentId: 'p1' });
    expect(published()).toEqual(['OrderConfirmed']);
    expect(tx.outboxEvent.create.mock.calls[0][0].data.payload.data.email).toBe('sahil@example.com');
  });

  it('PaymentSucceeded for an already CANCELLED order -> refund requested, order stays cancelled', async () => {
    tx.order.findUnique.mockResolvedValue(order('CANCELLED'));
    await saga.handle(ev('PaymentSucceeded', { paymentId: 'p1' }));
    expect(statusSet()).toEqual([]);
    expect(published()).toEqual(['RefundRequested']);
  });

  it('PaymentFailed -> PAYMENT_FAILED and OrderCancelled so inventory releases the reservation', async () => {
    tx.order.findUnique.mockResolvedValue(order('PENDING_PAYMENT'));
    await saga.handle(ev('PaymentFailed', { reason: 'CARD_DECLINED' }));
    expect(statusSet()).toEqual(['PAYMENT_FAILED']);
    expect(published()).toEqual(['OrderCancelled']);
  });

  it('does not confirm an order twice when the same event is delivered twice', async () => {
    tx.order.findUnique.mockResolvedValue(order('PENDING_PAYMENT'));
    await saga.handle(ev('PaymentSucceeded', { paymentId: 'p1' }));
    tx.processedEvent.findUnique.mockResolvedValue({ eventId: 'e1' }); // second delivery
    await saga.handle(ev('PaymentSucceeded', { paymentId: 'p1' }));
    expect(published()).toEqual(['OrderConfirmed']); // still only one
  });

  it('ignores events for unknown orders', async () => {
    tx.order.findUnique.mockResolvedValue(null);
    await saga.handle(ev('PaymentSucceeded', { paymentId: 'p1' }));
    expect(published()).toEqual([]);
  });
});

describe('ReconciliationService', () => {
  it('cancels orders that waited too long for payment and publishes OrderCancelled', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    const prisma = {
      order: { findMany: jest.fn().mockResolvedValue([{ id: 'o1', userId: 'u1' }]) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const service = new ReconciliationService(prisma as any, { get: () => 15 } as any);
    const now = new Date('2026-11-10T10:00:00Z');
    expect(await service.cancelExpired(now)).toBe(1);
    expect(prisma.order.findMany.mock.calls[0][0].where.createdAt.lt).toEqual(new Date('2026-11-10T09:45:00Z'));
    expect(tx.order.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', cancelReason: 'PAYMENT_TIMEOUT' });
    expect(tx.outboxEvent.create.mock.calls[0][0].data.type).toBe('OrderCancelled');
  });

  it('skips an order that changed in the meantime', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const tx = { order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) }, orderStatusHistory: { create: jest.fn() }, outboxEvent: { create: jest.fn() } };
    const prisma = { order: { findMany: jest.fn().mockResolvedValue([{ id: 'o1', userId: 'u1' }]) }, $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const service = new ReconciliationService(prisma as any, { get: () => 15 } as any);
    expect(await service.cancelExpired()).toBe(0);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
