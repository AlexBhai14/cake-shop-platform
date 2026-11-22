import { PaymentsSaga } from './payments.saga';

describe('PaymentsSaga', () => {
  let tx: any;
  let payments: { createFromRequest: jest.Mock; refund: jest.Mock; cancelPending: jest.Mock; markOrderDelivered: jest.Mock };
  let saga: PaymentsSaga;
  const ev = (type: string, data: Record<string, unknown>, eventId = 'e1') => ({
    eventId, type: type as any, version: 1, occurredAt: '', correlationId: 'corr', data,
  });

  beforeEach(() => {
    tx = { processedEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() } };
    const prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    payments = { createFromRequest: jest.fn(), refund: jest.fn(), cancelPending: jest.fn(), markOrderDelivered: jest.fn() };
    saga = new PaymentsSaga(prisma as any, { registerConsumer: jest.fn() } as any, payments as any);
  });

  it('creates a payment for PaymentRequested', async () => {
    await saga.handle(ev('PaymentRequested', { orderId: 'o1', userId: 'u1', amount: '10.00', currency: 'INR' }));
    expect(payments.createFromRequest).toHaveBeenCalledTimes(1);
  });

  it('ignores a duplicate delivery of the same event', async () => {
    tx.processedEvent.findUnique.mockResolvedValue({ eventId: 'e1' });
    await saga.handle(ev('PaymentRequested', { orderId: 'o1' }));
    expect(payments.createFromRequest).not.toHaveBeenCalled();
  });

  it('refunds on RefundRequested and cancels pending payments on OrderCancelled', async () => {
    await saga.handle(ev('RefundRequested', { orderId: 'o1', paymentId: 'p1', reason: 'ORDER_CANCELLED' }, 'e2'));
    await saga.handle(ev('OrderCancelled', { orderId: 'o1', userId: 'u1', reason: 'X' }, 'e3'));
    expect(payments.refund).toHaveBeenCalledWith(tx, 'o1', 'ORDER_CANCELLED', 'corr');
    expect(payments.cancelPending).toHaveBeenCalledWith(tx, 'o1');
  });

  it('marks the payment as not refundable when the order is DELIVERED', async () => {
    await saga.handle(ev('OrderStatusChanged', { orderId: 'o1', userId: 'u1', status: 'DELIVERED' }, 'e4'));
    expect(payments.markOrderDelivered).toHaveBeenCalledWith(tx, 'o1');
  });

  it('ignores other order status changes', async () => {
    await saga.handle(ev('OrderStatusChanged', { orderId: 'o1', userId: 'u1', status: 'PREPARING' }, 'e5'));
    expect(payments.markOrderDelivered).not.toHaveBeenCalled();
  });
});
