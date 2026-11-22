import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MockGateway } from './mock-gateway';
import { PaymentsService } from './payments.service';

describe('PaymentsService (MOCK payments)', () => {
  const customer = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };
  const other = { userId: 'u2', email: 'c@d.com', role: 'CUSTOMER' };
  const admin = { userId: 'a1', email: 'x@y.com', role: 'ADMIN' };
  const ORDER = '44444444-4444-4444-4444-444444444444';
  const pending = { id: 'p1', orderId: ORDER, userId: 'u1', status: 'PENDING', amount: { toString: () => '1847.00' } };

  let cfg: Record<string, unknown>;
  let tx: any;
  let prisma: any;
  let service: PaymentsService;

  const build = () => {
    const config = { get: (k: string) => cfg[k] } as any;
    service = new PaymentsService(prisma, new MockGateway(config), config);
  };
  const published = () => tx.outboxEvent.create.mock.calls.map((c: any) => c[0].data.type);

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    cfg = {};
    tx = {
      payment: {
        findUnique: jest.fn(), create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data })),
        update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentTransaction: { create: jest.fn(), updateMany: jest.fn() },
      wallet: { upsert: jest.fn().mockResolvedValue({ id: 'w1', balance: '1847.00' }) },
      walletTransaction: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    prisma = { ...tx, $transaction: jest.fn(async (fn: any) => fn(tx)) };
    prisma.payment.findUnique = tx.payment.findUnique;
    build();
  });

  describe('settle', () => {
    it('SUCCESS: records a CHARGE transaction and publishes PaymentSucceeded', async () => {
      expect(await service.settle(tx, pending, 'SUCCESS', 'corr')).toBe('SUCCEEDED');
      expect(tx.paymentTransaction.create.mock.calls[0][0].data).toMatchObject({ type: 'CHARGE', status: 'SUCCEEDED' });
      expect(tx.payment.update.mock.calls[0][0].data.status).toBe('SUCCEEDED');
      expect(published()).toEqual(['PaymentSucceeded']);
    });

    it('FAILURE: publishes PaymentFailed with CARD_DECLINED', async () => {
      expect(await service.settle(tx, pending, 'FAILURE', 'corr')).toBe('FAILED');
      expect(tx.outboxEvent.create.mock.calls[0][0].data.payload.data).toMatchObject({ orderId: ORDER, reason: 'CARD_DECLINED' });
    });

    it('TIMEOUT: result is UNKNOWN and NOTHING is published', async () => {
      expect(await service.settle(tx, pending, 'TIMEOUT', 'corr')).toBe('UNKNOWN');
      expect(tx.payment.update.mock.calls[0][0].data.status).toBe('UNKNOWN');
      expect(published()).toEqual([]);
    });
  });

  describe('createFromRequest', () => {
    const data = { orderId: ORDER, userId: 'u1', amount: '1847.00', currency: 'INR', email: 'a@b.com' };

    it('creates a PENDING payment and keeps the customer email for later notifications', async () => {
      tx.payment.findUnique.mockResolvedValue(null);
      await service.createFromRequest(tx, data, 'corr');
      expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ orderId: ORDER, status: 'PENDING', customerEmail: 'a@b.com' });
      expect(published()).toEqual([]); // waits for the customer
    });

    it('is idempotent: an existing payment is returned unchanged', async () => {
      tx.payment.findUnique.mockResolvedValue(pending);
      const p = await service.createFromRequest(tx, data, 'corr');
      expect(p).toBe(pending);
      expect(tx.payment.create).not.toHaveBeenCalled();
    });

    it('pays automatically when AUTO_PAY_SCENARIO is SUCCESS', async () => {
      cfg.AUTO_PAY_SCENARIO = 'SUCCESS';
      build();
      tx.payment.findUnique.mockResolvedValue(null);
      await service.createFromRequest(tx, data, 'corr');
      expect(published()).toEqual(['PaymentSucceeded']);
    });

    it('ignores AUTO_PAY_SCENARIO=NONE', async () => {
      cfg.AUTO_PAY_SCENARIO = 'NONE';
      build();
      tx.payment.findUnique.mockResolvedValue(null);
      await service.createFromRequest(tx, data, 'corr');
      expect(published()).toEqual([]);
    });
  });

  describe('pay', () => {
    it('returns 404 when no payment exists yet', async () => {
      tx.payment.findUnique.mockResolvedValue(null);
      await expect(service.pay(customer, ORDER)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("forbids paying for someone else's order", async () => {
      tx.payment.findUnique.mockResolvedValue(pending);
      await expect(service.pay(other, ORDER)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.pay(admin, ORDER)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses to pay a cancelled order', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'CANCELLED' });
      await expect(service.pay(customer, ORDER)).rejects.toBeInstanceOf(ConflictException);
    });

    it('settles a PENDING payment once', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, transactions: [] });
      await service.pay(customer, ORDER, 'SUCCESS');
      expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { id: 'p1', status: 'PENDING' }, data: { status: 'PROCESSING' } });
      expect(published()).toEqual(['PaymentSucceeded']);
    });

    it('is idempotent: an already processed payment is NOT charged again', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'SUCCEEDED', transactions: [] });
      const result = await service.pay(customer, ORDER, 'SUCCESS');
      expect(result.status).toBe('SUCCEEDED');
      expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
      expect(published()).toEqual([]);
    });

    it('does nothing when another request already claimed the payment', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, transactions: [] });
      tx.payment.updateMany.mockResolvedValue({ count: 0 });
      await service.pay(customer, ORDER, 'SUCCESS');
      expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
    });

    it('always includes the mock notice in the response', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'SUCCEEDED', transactions: [] });
      const result = await service.pay(customer, ORDER);
      expect(result.notice).toContain('No real money');
    });
  });

  describe('refund', () => {
    it('refunds a SUCCEEDED payment: REFUND transaction, status REFUNDED, RefundProcessed event', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'SUCCEEDED', customerEmail: 'a@b.com' });
      expect(await service.refund(tx, ORDER, 'ORDER_CANCELLED', 'corr')).toBe(true);
      expect(tx.paymentTransaction.create.mock.calls[0][0].data).toMatchObject({ type: 'REFUND', status: 'SUCCEEDED' });
      expect(tx.payment.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'REFUNDED' } });
      expect(tx.outboxEvent.create.mock.calls[0][0].data.payload.data).toMatchObject({ orderId: ORDER, userId: 'u1', amount: '1847.00', email: 'a@b.com' });
    });

    it('credits the refunded amount to the customer wallet in the same transaction', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'SUCCEEDED' });
      await service.refund(tx, ORDER, 'ORDER_CANCELLED', 'corr');
      expect(tx.wallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        create: { userId: 'u1', balance: '1847.00' },
        update: { balance: { increment: '1847.00' } },
      });
      expect(tx.walletTransaction.create.mock.calls[0][0].data).toMatchObject({
        walletId: 'w1', type: 'CREDIT', amount: '1847.00', balanceAfter: '1847.00', orderId: ORDER, paymentId: 'p1',
      });
    });

    it('does not touch the wallet when nothing was refunded', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'REFUNDED' });
      await service.refund(tx, ORDER, 'x', 'corr');
      expect(tx.wallet.upsert).not.toHaveBeenCalled();
    });

    it('never refunds twice', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'REFUNDED' });
      expect(await service.refund(tx, ORDER, 'x', 'corr')).toBe(false);
      expect(published()).toEqual([]);
    });

    it('does nothing for a payment that was never paid', async () => {
      tx.payment.findUnique.mockResolvedValue(pending);
      expect(await service.refund(tx, ORDER, 'x', 'corr')).toBe(false);
    });

    it('throws for an unsettled (UNKNOWN) payment so the refund is retried later', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'UNKNOWN' });
      await expect(service.refund(tx, ORDER, 'x', 'corr')).rejects.toThrow('not settled');
    });

    it('admin refund of a non-paid payment returns 409', async () => {
      tx.payment.findUnique.mockResolvedValue(pending);
      await expect(service.adminRefund(ORDER)).rejects.toBeInstanceOf(ConflictException);
    });

    it('admin refund of a DELIVERED order returns 409 and changes nothing', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...pending, status: 'SUCCEEDED', orderDelivered: true });
      await expect(service.adminRefund(ORDER)).rejects.toThrow('delivered');
      expect(tx.paymentTransaction.create).not.toHaveBeenCalled();
      expect(tx.wallet.upsert).not.toHaveBeenCalled();
      expect(published()).toEqual([]);
    });
  });

  describe('refundable flag', () => {
    const row = { ...pending, status: 'SUCCEEDED', transactions: [] };
    it('is true for a paid order that is not delivered', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...row, orderDelivered: false });
      expect((await service.getOne(admin, ORDER)).refundable).toBe(true);
    });
    it('is false once the order is delivered', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...row, orderDelivered: true });
      expect((await service.getOne(admin, ORDER)).refundable).toBe(false);
    });
    it('is false for a payment that is not SUCCEEDED', async () => {
      tx.payment.findUnique.mockResolvedValue({ ...row, status: 'REFUNDED' });
      expect((await service.getOne(admin, ORDER)).refundable).toBe(false);
    });
  });

  describe('markOrderDelivered', () => {
    it('flags the payment of that order', async () => {
      await service.markOrderDelivered(tx, ORDER);
      expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { orderId: ORDER }, data: { orderDelivered: true } });
    });
  });

  describe('cancelPending', () => {
    it('cancels only payments that are still PENDING', async () => {
      await service.cancelPending(tx, ORDER);
      expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { orderId: ORDER, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    });
  });

  describe('reconcile (uncertain outcomes)', () => {
    const unknown = { id: 'p1', orderId: ORDER, status: 'UNKNOWN' };

    it('asks the mock bank and publishes PaymentSucceeded for a payment that really succeeded', async () => {
      prisma.payment.findMany = jest.fn().mockResolvedValue([unknown]);
      expect(await service.reconcile(new Date())).toBe(1);
      expect(tx.payment.updateMany.mock.calls[0][0].data).toEqual({ status: 'SUCCEEDED' });
      expect(published()).toEqual(['PaymentSucceeded']);
    });

    it('publishes PaymentFailed when the bank says the payment failed', async () => {
      cfg.TIMEOUT_RESOLVES_TO = 'FAILED';
      build();
      prisma.payment.findMany = jest.fn().mockResolvedValue([unknown]);
      await service.reconcile(new Date());
      expect(tx.outboxEvent.create.mock.calls[0][0].data.payload.data.reason).toBe('TIMEOUT_RESOLVED_FAILED');
    });

    it('only looks at payments that have been UNKNOWN for long enough', async () => {
      prisma.payment.findMany = jest.fn().mockResolvedValue([]);
      await service.reconcile(new Date('2026-11-10T10:00:00Z'));
      expect(prisma.payment.findMany.mock.calls[0][0].where.updatedAt.lt).toEqual(new Date('2026-11-10T09:59:30Z'));
    });

    it('does nothing when the payment changed in the meantime', async () => {
      prisma.payment.findMany = jest.fn().mockResolvedValue([unknown]);
      tx.payment.updateMany.mockResolvedValue({ count: 0 });
      await service.reconcile(new Date());
      expect(published()).toEqual([]);
    });
  });
});
