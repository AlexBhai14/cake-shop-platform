import { fromMinor, toMinor } from './money.util';

// Statuses that count as "money received" (the order was paid and not cancelled)
export const PAID_STATUSES = ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export interface DayBucket {
  date: string; // YYYY-MM-DD (UTC)
  orders: number; // all orders created that day
  revenue: string; // only paid orders
}

// One bucket per day for the last `days` days (days without orders are included with zeros)
export function bucketByDay(
  rows: Array<{ createdAt: Date; totalAmount: string; status: string }>,
  days: number,
  now: Date,
): DayBucket[] {
  const buckets = new Map<string, { orders: number; revenueMinor: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    buckets.set(d.toISOString().slice(0, 10), { orders: 0, revenueMinor: 0 });
  }
  for (const row of rows) {
    const bucket = buckets.get(row.createdAt.toISOString().slice(0, 10));
    if (!bucket) continue; // older than the window
    bucket.orders++;
    if (PAID_STATUSES.includes(row.status)) bucket.revenueMinor += toMinor(row.totalAmount);
  }
  return [...buckets.entries()].map(([date, b]) => ({ date, orders: b.orders, revenue: fromMinor(b.revenueMinor) }));
}
