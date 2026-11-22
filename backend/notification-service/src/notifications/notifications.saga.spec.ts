import { NotificationsSaga } from './notifications.saga';

describe('NotificationsSaga', () => {
  let tx: any;
  let saga: NotificationsSaga;
  const ev = (type: string, data: Record<string, unknown>, eventId = 'e1') => ({
    eventId, type: type as any, version: 1, occurredAt: '', correlationId: 'corr', data,
  });
  const base = { orderId: 'abcdef12-0000-0000-0000-000000000000', userId: 'u1', email: 'sahil@example.com' };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    tx = { processedEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() }, notification: { create: jest.fn() } };
    saga = new NotificationsSaga({ $transaction: jest.fn(async (fn: any) => fn(tx)) } as any, { registerConsumer: jest.fn() } as any);
  });

  const saved = () => tx.notification.create.mock.calls.map((c: any) => c[0].data);

  it('saves an ORDER_CONFIRMED notification for the customer email', async () => {
    await saga.handle(ev('OrderConfirmed', base));
    expect(saved()).toHaveLength(1);
    expect(saved()[0]).toMatchObject({ type: 'ORDER_CONFIRMED', toEmail: 'sahil@example.com', userId: 'u1', eventId: 'e1' });
    expect(saved()[0].subject).toContain('Order confirmed');
  });

  it('turns OrderCancelled (PAYMENT_FAILED) into a payment-failed email', async () => {
    await saga.handle(ev('OrderCancelled', { ...base, reason: 'PAYMENT_FAILED' }));
    expect(saved()[0].subject).toContain('Payment failed');
  });

  it('handles status changes, shipping and refunds', async () => {
    await saga.handle(ev('OrderStatusChanged', { ...base, status: 'PREPARING' }, 'e2'));
    await saga.handle(ev('OrderShipped', base, 'e3'));
    await saga.handle(ev('RefundProcessed', { ...base, paymentId: 'p1', amount: '1847.00' }, 'e4'));
    expect(saved().map((s: any) => s.type)).toEqual(['ORDER_STATUS', 'ORDER_SHIPPED', 'REFUND_PROCESSED']);
  });

  it('does not send a second email for OUT_FOR_DELIVERY status changes', async () => {
    await saga.handle(ev('OrderStatusChanged', { ...base, status: 'OUT_FOR_DELIVERY' }));
    expect(saved()).toHaveLength(0);
  });

  it('skips events without an email address', async () => {
    await saga.handle(ev('OrderConfirmed', { orderId: 'o1', userId: 'u1' }));
    expect(saved()).toHaveLength(0);
  });

  it('is idempotent: a duplicate event creates no second notification', async () => {
    tx.processedEvent.findUnique.mockResolvedValue({ eventId: 'e1' });
    await saga.handle(ev('OrderConfirmed', base));
    expect(saved()).toHaveLength(0);
  });
});
