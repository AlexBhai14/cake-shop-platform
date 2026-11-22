import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PaymentRequestedAlias } from './types';
import { enqueueEvent } from '../messaging/idempotency';
import { PrismaService } from '../prisma/prisma.service';
import { MockGateway, Scenario } from './mock-gateway';
import { creditWallet } from '../wallet/wallet.service';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export const NOTICE = 'MOCK PAYMENT: this is a simulation. No real money is processed.';

// A payment can be refunded only while it is SUCCEEDED and the order has not been delivered yet.
export const isRefundable = (p: { status: string; orderDelivered?: boolean }) => p.status === 'SUCCEEDED' && !p.orderDelivered;
const AUTO = ['SUCCESS', 'FAILURE', 'TIMEOUT'];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MockGateway,
    private readonly config: ConfigService,
  ) {}

  // ---------- Saga side: PaymentRequested -> a payment record exists ----------
  async createFromRequest(tx: any, data: PaymentRequestedAlias, correlationId: string) {
    const existing = await tx.payment.findUnique({ where: { orderId: data.orderId } });
    if (existing) return existing; // idempotent
    const payment = await tx.payment.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        customerEmail: data.email ?? null,
        amount: data.amount,
        currency: data.currency,
        status: 'PENDING',
      },
    });
    const auto = this.config.get<string>('AUTO_PAY_SCENARIO');
    if (auto && AUTO.includes(auto)) {
      await this.settle(tx, payment, auto as Scenario, correlationId);
    }
    return payment;
  }

  // Asks the mock bank, records the transaction, updates the payment and publishes the result.
  async settle(tx: any, payment: { id: string; orderId: string; amount: unknown }, scenario: Scenario, correlationId: string) {
    const r = this.gateway.charge(scenario);
    await tx.paymentTransaction.create({
      data: { paymentId: payment.id, type: 'CHARGE', amount: payment.amount, status: r.outcome, gatewayRef: r.ref, reason: r.reason ?? null },
    });
    if (r.outcome === 'SUCCEEDED') {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', gatewayRef: r.ref } });
      await enqueueEvent(tx, 'PaymentSucceeded', { orderId: payment.orderId, paymentId: payment.id }, correlationId);
    } else if (r.outcome === 'FAILED') {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', gatewayRef: r.ref, failureReason: r.reason } });
      await enqueueEvent(tx, 'PaymentFailed', { orderId: payment.orderId, reason: r.reason ?? 'FAILED' }, correlationId);
    } else {
      // Unknown result: publish NOTHING. The reconciliation job will find out later.
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'UNKNOWN', gatewayRef: r.ref } });
    }
    return r.outcome;
  }

  // The order service told us the order was delivered: from now on no refund is allowed.
  async markOrderDelivered(tx: any, orderId: string) {
    await tx.payment.updateMany({ where: { orderId }, data: { orderDelivered: true } });
  }

  async cancelPending(tx: any, orderId: string) {
    // The order was cancelled: the customer must not be able to pay for it any more.
    await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  }

  // ---------- Customer side ----------
  async pay(user: AuthUser, orderId: string, scenario: Scenario = 'SUCCESS', correlationId: string = randomUUID()) {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment) throw new NotFoundException('No payment is waiting for this order yet. Try again in a moment.');
    if (payment.userId !== user.userId) throw new ForbiddenException('You cannot pay for this order');
    if (payment.status === 'CANCELLED') throw new ConflictException('This order was cancelled');

    // Idempotent: a second click (or a retry) never charges twice, it returns the stored result.
    if (payment.status === 'PENDING') {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'PROCESSING' } });
        if (claimed.count === 0) return; // another request is already handling it
        await this.settle(tx, payment, scenario, correlationId);
      });
    }
    return this.getOne(user, orderId);
  }

  async getOne(user: AuthUser, orderId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { orderId }, include: { transactions: { orderBy: { createdAt: 'asc' } } } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (user.role !== 'ADMIN' && payment.userId !== user.userId) throw new ForbiddenException('You cannot access this payment');
    return { ...payment, amount: payment.amount.toString(), refundable: isRefundable(payment), notice: NOTICE };
  }

  async listAll(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.payment.count(),
    ]);
    return { items: items.map((p) => ({ ...p, amount: p.amount.toString(), refundable: isRefundable(p) })), total, page, limit, notice: NOTICE };
  }

  // ---------- Refunds (mock) ----------
  // Returns true when a refund was made. Throws when the payment is not settled yet,
  // so the message goes to the retry queue and is tried again later.
  async refund(tx: any, orderId: string, reason: string, correlationId: string): Promise<boolean> {
    const payment = await tx.payment.findUnique({ where: { orderId } });
    if (!payment) return false;
    if (['PROCESSING', 'UNKNOWN'].includes(payment.status)) {
      throw new Error(`Payment ${payment.id} is not settled yet (${payment.status}), refund will be retried`);
    }
    if (payment.status !== 'SUCCEEDED') return false; // nothing was paid, or already refunded

    await tx.paymentTransaction.create({
      data: { paymentId: payment.id, type: 'REFUND', amount: payment.amount, status: 'SUCCEEDED', gatewayRef: `mock_refund_${randomUUID()}`, reason },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    // The refunded money goes to the customer's wallet (same transaction as the status change).
    await creditWallet(tx, { userId: payment.userId, amount: payment.amount, orderId, paymentId: payment.id, reason });
    await enqueueEvent(tx, 'RefundProcessed', {
      orderId, userId: payment.userId, paymentId: payment.id, amount: payment.amount.toString(), email: payment.customerEmail ?? undefined,
    }, correlationId);
    return true;
  }

  async adminRefund(orderId: string, correlationId: string = randomUUID()) {
    const done = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { orderId } });
      if (payment?.orderDelivered) throw new ConflictException('A delivered order cannot be refunded');
      return this.refund(tx, orderId, 'ADMIN_REFUND', correlationId);
    });
    if (!done) throw new ConflictException('Only a SUCCEEDED payment can be refunded');
    return this.getOne({ userId: 'admin', email: '', role: 'ADMIN' }, orderId);
  }

  // ---------- Reconciliation of UNKNOWN payments ----------
  async reconcile(now: Date = new Date()): Promise<number> {
    const seconds = Number(this.config.get('RECONCILE_AFTER_SECONDS') ?? 30);
    const cutoff = new Date(now.getTime() - seconds * 1000);
    const unknown = await this.prisma.payment.findMany({ where: { status: 'UNKNOWN', updatedAt: { lt: cutoff } }, take: 50 });
    let resolved = 0;
    for (const payment of unknown) {
      try {
        const outcome = this.gateway.lookup();
        await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: 'UNKNOWN' },
            data: outcome === 'SUCCEEDED' ? { status: 'SUCCEEDED' } : { status: 'FAILED', failureReason: 'TIMEOUT_RESOLVED_FAILED' },
          });
          if (claimed.count === 0) return;
          await tx.paymentTransaction.updateMany({ where: { paymentId: payment.id, type: 'CHARGE', status: 'UNKNOWN' }, data: { status: outcome } });
          const corr = randomUUID();
          if (outcome === 'SUCCEEDED') {
            await enqueueEvent(tx, 'PaymentSucceeded', { orderId: payment.orderId, paymentId: payment.id }, corr);
          } else {
            await enqueueEvent(tx, 'PaymentFailed', { orderId: payment.orderId, reason: 'TIMEOUT_RESOLVED_FAILED' }, corr);
          }
        });
        resolved++;
      } catch (e) {
        console.error(JSON.stringify({ level: 'error', service: 'payment-service', msg: 'reconcile failed', paymentId: payment.id, error: String(e) }));
      }
    }
    return resolved;
  }
}
