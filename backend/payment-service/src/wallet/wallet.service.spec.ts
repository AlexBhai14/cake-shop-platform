import { creditWallet, debitWallet, WalletService } from './wallet.service';

describe('Wallet (MOCK)', () => {
  describe('creditWallet', () => {
    it('adds money with an atomic increment and records a CREDIT passbook line', async () => {
      const tx: any = {
        wallet: { upsert: jest.fn().mockResolvedValue({ id: 'w1', balance: '2500.00' }) },
        walletTransaction: { create: jest.fn() },
      };
      await creditWallet(tx, { userId: 'u1', amount: '650.00', orderId: 'o1', paymentId: 'p1', reason: 'ORDER_CANCELLED' });
      expect(tx.wallet.upsert.mock.calls[0][0].update).toEqual({ balance: { increment: '650.00' } });
      expect(tx.walletTransaction.create.mock.calls[0][0].data).toMatchObject({
        walletId: 'w1', type: 'CREDIT', amount: '650.00', balanceAfter: '2500.00', paymentId: 'p1',
      });
    });
  });

  describe('debitWallet', () => {
    const input = { userId: 'u1', amount: '650.00', orderId: 'o1', paymentId: 'p1', reason: 'ORDER_PAYMENT' };

    it('subtracts only if the balance is enough (one atomic statement) and records a DEBIT line', async () => {
      const tx: any = {
        wallet: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ id: 'w1', balance: '350.00' }) },
        walletTransaction: { create: jest.fn() },
      };
      await debitWallet(tx, input);
      expect(tx.wallet.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', balance: { gte: '650.00' } },
        data: { balance: { decrement: '650.00' } },
      });
      expect(tx.walletTransaction.create.mock.calls[0][0].data).toMatchObject({ type: 'DEBIT', amount: '650.00', balanceAfter: '350.00' });
    });

    it('throws and records nothing when the balance is too small (or there is no wallet)', async () => {
      const tx: any = {
        wallet: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUnique: jest.fn() },
        walletTransaction: { create: jest.fn() },
      };
      await expect(debitWallet(tx, input)).rejects.toThrow('Not enough balance');
      expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('WalletService', () => {
    const dec = (v: string) => ({ toString: () => v });
    let prisma: any;
    let service: WalletService;

    beforeEach(() => {
      prisma = { wallet: { findUnique: jest.fn() }, walletTransaction: { findMany: jest.fn(), count: jest.fn() } };
      service = new WalletService(prisma);
    });

    it('returns a zero balance for a customer who never got a refund', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);
      expect(await service.getMine('u1')).toMatchObject({ balance: '0.00', currency: 'INR' });
    });

    it('returns the balance as a string', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w1', balance: dec('1847.00'), currency: 'INR' });
      expect((await service.getMine('u1')).balance).toBe('1847.00');
    });

    it('looks up the wallet by the caller user id only', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);
      await service.getMine('u1');
      expect(prisma.wallet.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('lists transactions newest first and converts money to strings', async () => {
      prisma.wallet.findUnique.mockResolvedValue({ id: 'w1' });
      prisma.walletTransaction.findMany.mockResolvedValue([{ id: 't1', amount: dec('650.00'), balanceAfter: dec('650.00') }]);
      prisma.walletTransaction.count.mockResolvedValue(1);
      const r = await service.transactionsMine('u1', 1, 20);
      expect(prisma.walletTransaction.findMany.mock.calls[0][0]).toMatchObject({ where: { walletId: 'w1' }, orderBy: { createdAt: 'desc' } });
      expect(r.items[0]).toMatchObject({ amount: '650.00', balanceAfter: '650.00' });
      expect(r.total).toBe(1);
    });

    it('returns an empty list when there is no wallet yet', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);
      expect(await service.transactionsMine('u1')).toMatchObject({ items: [], total: 0 });
    });
  });
});
