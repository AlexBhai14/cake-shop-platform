import { detectNewOrders } from './alerts';
import { AdminOrder } from './types';

const order = (id: string, status: AdminOrder['status']): AdminOrder =>
  ({ id, status, userId: 'u1', customerEmail: 'a@b.com', totalAmount: '100.00', currency: 'INR', createdAt: '2026-11-22T10:00:00Z', items: [] }) as unknown as AdminOrder;

describe('detectNewOrders', () => {
  it('first look after login: marks existing paid orders as seen and raises NO alert', () => {
    const r = detectNewOrders(null, [order('a', 'CONFIRMED'), order('b', 'PENDING_PAYMENT')]);
    expect(r.fresh).toEqual([]);
    expect([...r.seen]).toEqual(['a']);
  });

  it('alerts for a paid order that was not seen before', () => {
    const r = detectNewOrders(new Set(['a']), [order('a', 'CONFIRMED'), order('c', 'CONFIRMED')]);
    expect(r.fresh.map((o) => o.id)).toEqual(['c']);
    expect(r.seen.has('c')).toBe(true);
  });

  it('does not alert twice for the same order', () => {
    const first = detectNewOrders(new Set(), [order('c', 'CONFIRMED')]);
    const second = detectNewOrders(first.seen, [order('c', 'CONFIRMED')]);
    expect(second.fresh).toEqual([]);
  });

  it('ignores orders that are still waiting for payment, and alerts once they are paid', () => {
    const waiting = detectNewOrders(new Set(), [order('d', 'PENDING_PAYMENT')]);
    expect(waiting.fresh).toEqual([]);
    const paid = detectNewOrders(waiting.seen, [order('d', 'CONFIRMED')]);
    expect(paid.fresh.map((o) => o.id)).toEqual(['d']);
  });

  it('ignores orders that moved on (accepted, delivered, cancelled)', () => {
    const r = detectNewOrders(new Set(), [order('e', 'ACCEPTED'), order('f', 'DELIVERED'), order('g', 'CANCELLED')]);
    expect(r.fresh).toEqual([]);
  });
});
