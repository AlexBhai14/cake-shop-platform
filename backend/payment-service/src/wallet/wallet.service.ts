import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Credits a refund to the customer's wallet.
// Runs INSIDE the caller's database transaction (the same one that marks the payment REFUNDED),
// so "payment refunded" and "wallet credited" always happen together or not at all.
export async function creditWallet(
  tx: any,
  input: { userId: string; amount: { toString(): string } | string; orderId: string; paymentId: string; reason: string },
) {
  // Atomic increment: two refunds at the same time can never overwrite each other's balance.
  const wallet = await tx.wallet.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, balance: input.amount.toString() },
    update: { balance: { increment: input.amount.toString() } },
  });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'CREDIT',
      amount: input.amount.toString(),
      balanceAfter: wallet.balance,
      orderId: input.orderId,
      paymentId: input.paymentId,
      reason: input.reason,
    },
  });
  return wallet;
}

// Takes money from the wallet to pay for an order. Also runs INSIDE the caller's transaction.
// The balance check and the subtraction are ONE database statement ("only if balance >= amount"),
// so two payments at the same moment can never spend the same money twice.
export async function debitWallet(
  tx: any,
  input: { userId: string; amount: { toString(): string } | string; orderId: string; paymentId: string; reason: string },
) {
  const amount = input.amount.toString();
  const done = await tx.wallet.updateMany({
    where: { userId: input.userId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (done.count === 0) throw new BadRequestException('Not enough balance in your wallet');
  const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'DEBIT',
      amount,
      balanceAfter: wallet.balance,
      orderId: input.orderId,
      paymentId: input.paymentId,
      reason: input.reason,
    },
  });
  return wallet;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  // A customer who never got a refund simply has an empty wallet (nothing is created on read).
  async getMine(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return {
      balance: wallet ? wallet.balance.toString() : '0.00',
      currency: wallet?.currency ?? 'INR',
      notice: 'MOCK WALLET: this is a simulation. No real money is stored.',
    };
  }

  async transactionsMine(userId: string, page = 1, limit = 20) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { items: [], total: 0, page, limit };
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return {
      items: items.map((t) => ({ ...t, amount: t.amount.toString(), balanceAfter: t.balanceAfter.toString() })),
      total,
      page,
      limit,
    };
  }
}
