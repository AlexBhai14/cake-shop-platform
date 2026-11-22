import { barHeights, buildStockRows, fetchAll, mergeCustomers } from './admin';
import { AdminUser, Cake, StockItem } from './types';

const cake: Cake = {
  id: 'c1', name: 'Chocolate Truffle', slug: 'chocolate-truffle', description: 'x', imageUrl: null, isActive: true, categoryId: 'k1',
  variants: [
    { id: 'v1', cakeId: 'c1', flavour: 'Chocolate', weightGrams: 500, eggless: false, price: '549.00', isActive: true },
    { id: 'v2', cakeId: 'c1', flavour: 'Chocolate', weightGrams: 1000, eggless: false, price: '999.00', isActive: false },
  ],
};

describe('buildStockRows', () => {
  it('marks variants without a stock record as made to order', () => {
    const rows = buildStockRows([cake], []);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ cakeName: 'Chocolate Truffle', tracked: false, onHand: null, available: null });
  });

  it('computes available = onHand - reserved for tracked variants', () => {
    const items: StockItem[] = [{ id: 's1', variantId: 'v1', onHand: 10, reserved: 3, available: 7 }];
    const rows = buildStockRows([cake], items);
    expect(rows[0]).toMatchObject({ tracked: true, onHand: 10, reserved: 3, available: 7 });
    expect(rows[1].tracked).toBe(false);
    expect(rows[1].variantActive).toBe(false);
  });
});

describe('mergeCustomers', () => {
  const users: AdminUser[] = [
    { id: 'u1', email: 'a@b.com', role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-11-01T00:00:00Z' },
    { id: 'u2', email: 'c@d.com', role: 'CUSTOMER', status: 'SUSPENDED', createdAt: '2026-11-02T00:00:00Z' },
  ];

  it('adds name and phone from the profile, and null when the customer has no profile yet', () => {
    const rows = mergeCustomers(users, [{ id: 'p1', userId: 'u1', email: 'a@b.com', fullName: 'Sahil', phone: '+91 99999 99999' }]);
    expect(rows[0]).toMatchObject({ email: 'a@b.com', fullName: 'Sahil', phone: '+91 99999 99999' });
    expect(rows[1]).toMatchObject({ email: 'c@d.com', fullName: null, phone: null, status: 'SUSPENDED' });
  });
});

describe('barHeights', () => {
  it('scales to the tallest bar', () => {
    expect(barHeights([0, 5, 10])).toEqual([0, 50, 100]);
  });
  it('does not divide by zero when everything is zero or the list is empty', () => {
    expect(barHeights([0, 0, 0])).toEqual([0, 0, 0]);
    expect(barHeights([])).toEqual([]);
  });
});

describe('fetchAll', () => {
  it('collects every page until the total is reached', async () => {
    const pages: Record<number, number[]> = { 1: [1, 2], 2: [3, 4], 3: [5] };
    const fetchPage = vi.fn(async (p: number) => ({ items: pages[p] ?? [], total: 5 }));
    expect(await fetchAll(fetchPage)).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('stops on an empty page even if the total is wrong', async () => {
    const fetchPage = vi.fn(async (p: number) => ({ items: p === 1 ? [1] : [], total: 99 }));
    expect(await fetchAll(fetchPage)).toEqual([1]);
  });
});
