import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { enqueueEvent } from '../messaging/idempotency';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/order.dto';
import { parseDate, validateDeliveryDate } from './delivery.util';
import { ServiceClients } from './http-clients';
import { fromMinor, toMinor } from './money.util';
import { bucketByDay, PAID_STATUSES } from './stats.util';
import { ADMIN_CANCELLABLE, ADMIN_TARGETS, CUSTOMER_CANCELLABLE, OrderStatus } from './order-status';
import { applyTransition } from './transition';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

const INCLUDE = { items: true, history: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ServiceClients,
    private readonly config: ConfigService,
  ) {}

  // ---------- Checkout: step 1-4 of the saga. The rest happens through events. ----------
  async checkout(user: AuthUser, authorization: string, dto: CheckoutDto, correlationId: string, idempotencyKey?: string) {
    // A repeated request with the same key returns the first order instead of creating a second one.
    if (idempotencyKey) {
      const existing = await this.prisma.order.findFirst({
        where: { userId: user.userId, idempotencyKey },
        include: INCLUDE,
      });
      if (existing) return existing;
    }

    validateDeliveryDate(
      dto.deliveryDate,
      new Date(),
      Number(this.config.get('MIN_LEAD_DAYS') ?? 1),
      Number(this.config.get('MAX_ADVANCE_DAYS') ?? 60),
    );

    // The cart view already contains the CURRENT prices from the product service.
    const cart = await this.clients.getCart(authorization);
    if (cart.items.length === 0) throw new BadRequestException('Your cart is empty');
    if (cart.hasUnavailableItems) {
      throw new ConflictException('Some cakes in your cart are no longer available. Please remove them.');
    }
    const address = await this.clients.getAddress(authorization, dto.addressId);
    if (!address) throw new BadRequestException('Delivery address not found');

    const totalMinor = cart.items.reduce((sum, i) => sum + toMinor(i.lineTotal), 0);
    const totalAmount = fromMinor(totalMinor);

    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            userId: user.userId,
            customerEmail: user.email,
            status: 'PENDING_PAYMENT',
            totalAmount,
            currency: 'INR',
            deliveryDate: parseDate(dto.deliveryDate),
            deliverySlot: dto.deliverySlot,
            deliveryAddress: address as any,
            idempotencyKey: idempotencyKey ?? null,
            items: {
              create: cart.items.map((i) => ({
                variantId: i.variantId,
                cakeName: i.cakeName,
                flavour: i.flavour ?? '',
                weightGrams: i.weightGrams ?? 0,
                eggless: i.eggless ?? false,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
                message: i.message,
              })),
            },
            history: { create: { fromStatus: null, toStatus: 'PENDING_PAYMENT', changedBy: 'customer' } },
          },
          include: INCLUDE,
        });
        // Outbox: the OrderCreated event is saved in the same transaction as the order.
        await enqueueEvent(
          tx,
          'OrderCreated',
          {
            orderId: created.id,
            userId: user.userId,
            items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
            deliveryDate: dto.deliveryDate,
            deliverySlot: dto.deliverySlot,
            totalAmount,
            currency: 'INR',
          },
          correlationId,
        );
        return created;
      });
    } catch (e) {
      // Two identical requests at the same moment: the unique key lets only one win.
      if (idempotencyKey && (e as { code?: string })?.code === 'P2002') {
        const existing = await this.prisma.order.findFirst({ where: { userId: user.userId, idempotencyKey }, include: INCLUDE });
        if (existing) return existing;
      }
      throw e;
    }

    await this.clients.clearCart(authorization);
    return order;
  }

  // ---------- Reading ----------
  listMine(user: AuthUser, page = 1, limit = 20) {
    return this.prisma.order.findMany({
      where: { userId: user.userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async listAll(status?: string, page = 1, limit = 20) {
    const where = status ? { status: status as OrderStatus } : {};
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getOne(user: AuthUser, id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    // A customer may only see their own orders (HTTP 403 otherwise).
    if (user.role !== 'ADMIN' && order.userId !== user.userId) {
      throw new ForbiddenException('You cannot access this order');
    }
    return order;
  }

  // ---------- Admin analytics ----------
  // (the Prisma client is used loosely typed here because groupBy has very strict generic types)
  async adminStats(days = 14) {
    const db = this.prisma as any;
    const since = new Date(Date.now() - days * 86_400_000);
    const [byStatus, recent, top] = await Promise.all([
      db.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalAmount: true } }),
      db.order.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, totalAmount: true, status: true }, take: 10000 }),
      db.orderItem.groupBy({
        by: ['cakeName'],
        where: { order: { status: { in: PAID_STATUSES } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    let totalOrders = 0;
    let revenueMinor = 0;
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
      totalOrders += row._count._all;
      if (PAID_STATUSES.includes(row.status)) revenueMinor += toMinor(row._sum.totalAmount?.toString() ?? '0');
    }
    return {
      totalOrders,
      revenue: fromMinor(revenueMinor),
      currency: 'INR',
      statusCounts,
      daily: bucketByDay(
        recent.map((r: any) => ({ createdAt: r.createdAt, totalAmount: r.totalAmount.toString(), status: r.status })),
        days,
        new Date(),
      ),
      topCakes: top.map((t: any) => ({ cakeName: t.cakeName, quantity: t._sum.quantity ?? 0 })),
    };
  }

  // ---------- Cancellation ----------
  async cancel(user: AuthUser, id: string, correlationId: string, reason = 'CUSTOMER_REQUEST') {
    const order = await this.getOne(user, id);
    const allowed = user.role === 'ADMIN' ? ADMIN_CANCELLABLE : CUSTOMER_CANCELLABLE;
    if (!allowed.includes(order.status as OrderStatus)) {
      throw new ConflictException(`An order in status ${order.status} cannot be cancelled`);
    }
    await this.prisma.$transaction(async (tx) => {
      await applyTransition(tx, id, order.status as OrderStatus, 'CANCELLED', user.role === 'ADMIN' ? 'admin' : 'customer', reason, { cancelReason: reason });
      // Compensation: inventory releases stock and slot when it receives this event.
      await enqueueEvent(tx, 'OrderCancelled', { orderId: id, userId: order.userId, reason, email: order.customerEmail ?? undefined }, correlationId);
      // Already paid? Ask the payment service for a refund.
      if (order.paymentId) {
        await enqueueEvent(tx, 'RefundRequested', { orderId: id, paymentId: order.paymentId, reason: 'ORDER_CANCELLED' }, correlationId);
      }
    });
    return this.getOne(user, id);
  }

  // ---------- Admin: move the order along the production pipeline ----------
  async adminSetStatus(admin: AuthUser, id: string, status: OrderStatus, correlationId: string) {
    if (!ADMIN_TARGETS.includes(status)) throw new BadRequestException('This status cannot be set manually');
    if (status === 'CANCELLED') return this.cancel(admin, id, correlationId, 'CANCELLED_BY_ADMIN');

    const order = await this.getOne(admin, id);
    await this.prisma.$transaction(async (tx) => {
      await applyTransition(tx, id, order.status as OrderStatus, status, 'admin');
      await enqueueEvent(tx, 'OrderStatusChanged', { orderId: id, userId: order.userId, status, email: order.customerEmail ?? undefined }, correlationId);
      if (status === 'OUT_FOR_DELIVERY') {
        await enqueueEvent(tx, 'OrderShipped', { orderId: id, userId: order.userId, email: order.customerEmail ?? undefined }, correlationId);
      }
    });
    return this.getOne(admin, id);
  }
}
