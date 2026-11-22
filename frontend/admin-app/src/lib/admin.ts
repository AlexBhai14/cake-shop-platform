import { AdminUser, Cake, StockItem } from './types';
import { Profile } from './shared-types';

export interface StockRow {
  variantId: string;
  cakeName: string;
  cakeActive: boolean;
  variantActive: boolean;
  flavour: string;
  weightGrams: number;
  eggless: boolean;
  tracked: boolean; // false = made to order (no stock limit, only slot capacity limits it)
  onHand: number | null;
  reserved: number | null;
  available: number | null;
}

// Joins the product catalogue (names) with the inventory records (numbers).
// The two come from different services, so the join happens here.
export function buildStockRows(cakes: Cake[], items: StockItem[]): StockRow[] {
  const byVariant = new Map(items.map((i) => [i.variantId, i]));
  const rows: StockRow[] = [];
  for (const cake of cakes) {
    for (const v of cake.variants) {
      const s = byVariant.get(v.id);
      rows.push({
        variantId: v.id,
        cakeName: cake.name,
        cakeActive: cake.isActive,
        variantActive: v.isActive,
        flavour: v.flavour,
        weightGrams: v.weightGrams,
        eggless: v.eggless,
        tracked: !!s,
        onHand: s?.onHand ?? null,
        reserved: s?.reserved ?? null,
        available: s ? s.onHand - s.reserved : null,
      });
    }
  }
  return rows;
}

export interface CustomerRow extends AdminUser {
  fullName: string | null;
  phone: string | null;
}

// Account data (auth service) + profile data (user service)
export function mergeCustomers(users: AdminUser[], profiles: Profile[]): CustomerRow[] {
  const byUser = new Map(profiles.map((p) => [p.userId, p]));
  return users.map((u) => ({ ...u, fullName: byUser.get(u.id)?.fullName ?? null, phone: byUser.get(u.id)?.phone ?? null }));
}

// Bar heights in percent; the tallest bar is 100. All zeros give all zeros (no division by zero).
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max === 0 ? 0 : Math.round((v / max) * 100)));
}

// Collects every page of a paginated endpoint (the backend limits one page to 100 rows)
export async function fetchAll<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(page);
    all.push(...res.items);
    if (res.items.length === 0 || all.length >= res.total) break;
  }
  return all;
}
