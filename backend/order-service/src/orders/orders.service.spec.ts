import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const customer = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };
  const other = { userId: 'u2', email: 'c@d.com', role: 'CUSTOMER' };
  const admin = { userId: 'a1', email: 'admin@x.com', role: 'ADMIN' };
  const ADDRESS = '33333333-3333-3333-3333-333333333333';
  const config = { get: (k: string) => ({ MIN_LEAD_DAYS: 1, MAX_ADVANCE_DAYS: 365 } as any)[k] } as any;

  let tx: any;
  let prisma: any;
  let clients: { getCart: jest.Mock; getAddress: jest.Mock; clearCart: jest.Mock };
  let service: OrdersService;

  const cartWith = (over: Record<string, unknown> = {}) => ({
    items: [
      { variantId: 'v1', quantity: 2, message: 'Happy Birthday', cakeName: 'Chocolate Truffle', flavour: 'Chocolate', weightGrams: 500, eggless: false, unitPrice: '549.00', lineTotal: '1098.00', available: true },
      { variantId: 'v2', quantity: 1, message: null, cakeName: 'Red Velvet', flavour: 'Red Velvet', weightGrams: 500, eggless: true, unitPrice: '749.00', lineTotal: '749.00', available: true },
    ],
    subtotal: '1847.00', currency: 'INR', hasUnavailableItems: false, ...over,
  });
  const future = () => new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const dto = () => ({ addressId: ADDRESS, deliveryDate: future(), deliverySlot: '10:00-12:00' });

  beforeEach(() => {
    tx = {
      order: { create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'o1', ...data })), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    clients = {
      getCart: jest.fn().mockResolvedValue(cartWith()),
      getAddress: jest.fn().mockResolvedValue({ id: ADDRESS, label: 'Home', city: 'Mumbai' }),
      clearCart: jest.fn(),
    };
    service = new OrdersService(prisma, clients as any, config);
  });

  const events = () => tx.outboxEvent.create.mock.calls.map((c: any) => c[0].data.type);

  describe('checkout', () => {
    it('creates a PENDING_PAYMENT order with price snapshots and an OrderCreated outbox event', async () => {
      const order = await service.checkout(customer, 'Bearer t', dto(), 'corr');
      const data = tx.order.create.mock.calls[0][0].data;
      expect(data.status).toBe('PENDING_PAYMENT');
      expect(data.totalAmount).toBe('1847.00');
      expect(data.items.create[0]).toMatchObject({ variantId: 'v1', unitPrice: '549.00', quantity: 2 });
      expect(data.deliveryAddress).toMatchObject({ city: 'Mumbai' });
      expect(events()).toEqual(['OrderCreated']);
      const payload = tx.outboxEvent.create.mock.calls[0][0].data.payload.data;
      expect(payload).toMatchObject({ orderId: 'o1', totalAmount: '1847.00', items: [{ variantId: 'v1', quantity: 2 }, { variantId: 'v2', quantity: 1 }] });
      expect(clients.clearCart).toHaveBeenCalled();
      expect(order.id).toBe('o1');
    });

    it('returns the existing order for a repeated Idempotency-Key', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'existing' });
      const order = await service.checkout(customer, 'Bearer t', dto(), 'corr', 'key-1');
      expect(order.id).toBe('existing');
      expect(tx.order.create).not.toHaveBeenCalled();
      expect(clients.getCart).not.toHaveBeenCalled();
    });

    it('rejects an empty cart', async () => {
      clients.getCart.mockResolvedValue(cartWith({ items: [] }));
      await expect(service.checkout(customer, 'Bearer t', dto(), 'corr')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a cart that contains unavailable cakes', async () => {
      clients.getCart.mockResolvedValue(cartWith({ hasUnavailableItems: true }));
      await expect(service.checkout(customer, 'Bearer t', dto(), 'corr')).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an address that does not belong to the customer', async () => {
      clients.getAddress.mockResolvedValue(null);
      await expect(service.checkout(customer, 'Bearer t', dto(), 'corr')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a delivery date in the past without calling other services', async () => {
      await expect(service.checkout(customer, 'Bearer t', { ...dto(), deliveryDate: '2020-01-01' }, 'corr')).rejects.toBeInstanceOf(BadRequestException);
      expect(clients.getCart).not.toHaveBeenCalled();
    });
  });

  describe('getOne (authorization)', () => {
    it("forbids a customer from reading another customer's order", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1' });
      await expect(service.getOne(other, 'o1')).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('allows the owner and an admin', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1' });
      await expect(service.getOne(customer, 'o1')).resolves.toBeDefined();
      await expect(service.getOne(admin, 'o1')).resolves.toBeDefined();
    });
  });

  describe('cancel', () => {
    it('cancels a PENDING_PAYMENT order and publishes OrderCancelled', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1', status: 'PENDING_PAYMENT', paymentId: null });
      await service.cancel(customer, 'o1', 'corr');
      expect(tx.order.updateMany).toHaveBeenCalledWith({ where: { id: 'o1', status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED', cancelReason: 'CUSTOMER_REQUEST' } });
      expect(events()).toEqual(['OrderCancelled']);
    });

    it('also requests a refund when the order was already paid', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1', status: 'CONFIRMED', paymentId: 'p1' });
      await service.cancel(customer, 'o1', 'corr');
      expect(events()).toEqual(['OrderCancelled', 'RefundRequested']);
    });

    it('does not let a customer cancel once the shop accepted the order, but an admin can', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1', status: 'ACCEPTED', paymentId: 'p1' });
      await expect(service.cancel(customer, 'o1', 'corr')).rejects.toBeInstanceOf(ConflictException);
      await expect(service.cancel(admin, 'o1', 'corr')).resolves.toBeDefined();
    });

    it('does not cancel a cake that is already being prepared, even for an admin', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1', status: 'PREPARING' });
      await expect(service.cancel(admin, 'o1', 'corr')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('adminSetStatus', () => {
    it('rejects statuses reserved for the payment saga', async () => {
      await expect(service.adminSetStatus(admin, 'o1', 'CONFIRMED' as any, 'corr')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid jump such as CONFIRMED -> DELIVERED', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1', status: 'CONFIRMED' });
      await expect(service.adminSetStatus(admin, 'o1', 'DELIVERED', 'corr')).rejects.toBeInstanceOf(ConflictException);
    });

    it('publishes OrderStatusChanged and OrderShipped when the order goes out for delivery', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1', status: 'READY_FOR_DISPATCH' });
      await service.adminSetStatus(admin, 'o1', 'OUT_FOR_DELIVERY', 'corr');
      expect(events()).toEqual(['OrderStatusChanged', 'OrderShipped']);
    });
  });
});
