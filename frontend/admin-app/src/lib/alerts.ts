import { AdminOrder } from './types';

// "New order" for the shop owner = an order that is PAID (CONFIRMED) and waits for the admin to accept it.
// An order that is only waiting for payment is not an alert yet.
//
// seen === null means "this is the first look after login": everything that is already there is marked as seen
// silently, so the admin is not flooded with old orders. After that, every CONFIRMED order we have not seen is new.
export function detectNewOrders(seen: Set<string> | null, orders: AdminOrder[]): { fresh: AdminOrder[]; seen: Set<string> } {
  const confirmed = orders.filter((o) => o.status === 'CONFIRMED');
  if (seen === null) return { fresh: [], seen: new Set(confirmed.map((o) => o.id)) };
  const fresh = confirmed.filter((o) => !seen.has(o.id));
  const next = new Set(seen);
  fresh.forEach((o) => next.add(o.id));
  return { fresh, seen: next };
}
