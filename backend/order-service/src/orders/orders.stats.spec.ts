import { OrdersService } from './orders.service';
import { bucketByDay } from './stats.util';

describe('bucketByDay', () => {
  const now = new Date('2026-11-10T12:00:00Z');

  it('returns one bucket per day, including days without orders', () => {
    const r = bucketByDay([], 3, now);
    expect(r.map((b) => b.date)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
    expect(r.every((b) => b.orders === 0 && b.revenue === '0.00')).toBe(true);
  });

  it('counts every order but adds revenue only for paid statuses', () => {
    const r = bucketByDay(
      [
        { createdAt: new Date('2026-11-10T08:00:00Z'), totalAmount: '549.00', status: 'CONFIRMED' },
        { createdAt: new Date('2026-11-10T09:00:00Z'), totalAmount: '100.00', status: 'CANCELLED' },
        { createdAt: new Date('2026-11-09T09:00:00Z'), totalAmount: '999.50', status: 'DELIVERED' },
      ],
      2,
      now,
    );
    expect(r[1]).toEqual({ date: '2026-11-10', orders: 2, revenue: '549.00' });
    expect(r[0]).toEqual({ date: '2026-11-09', orders: 1, revenue: '999.50' });
  });

  it('ignores orders outside the window', () => {
    const r = bucketByDay([{ createdAt: new Date('2026-10-01T00:00:00Z'), totalAmount: '10.00', status: 'DELIVERED' }], 3, now);
    expect(r.reduce((n, b) => n + b.orders, 0)).toBe(0);
  });
});

describe('OrdersService.adminStats', () => {
  it('combines status counts, revenue of paid orders, daily buckets and top cakes', async () => {
    const prisma = {
      order: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'DELIVERED', _count: { _all: 2 }, _sum: { totalAmount: { toString: () => '1500.00' } } },
          { status: 'CONFIRMED', _count: { _all: 1 }, _sum: { totalAmount: { toString: () => '549.00' } } },
          { status: 'CANCELLED', _count: { _all: 3 }, _sum: { totalAmount: { toString: () => '9999.00' } } },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: { groupBy: jest.fn().mockResolvedValue([{ cakeName: 'Red Velvet', _sum: { quantity: 7 } }]) },
    };
    const service = new OrdersService(prisma as any, {} as any, { get: () => undefined } as any);

    const stats = await service.adminStats(7);

    expect(stats.totalOrders).toBe(6);
    expect(stats.revenue).toBe('2049.00'); // the cancelled orders are NOT counted as revenue
    expect(stats.statusCounts).toEqual({ DELIVERED: 2, CONFIRMED: 1, CANCELLED: 3 });
    expect(stats.daily).toHaveLength(7);
    expect(stats.topCakes).toEqual([{ cakeName: 'Red Velvet', quantity: 7 }]);
    expect(prisma.orderItem.groupBy.mock.calls[0][0].where.order.status.in).not.toContain('CANCELLED');
  });
});
