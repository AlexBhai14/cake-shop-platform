const pad = (n: number) => String(n).padStart(2, '0');

export const toLocalIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Cakes need at least one day notice: the earliest delivery date is tomorrow
export function earliestDeliveryDate(now: Date = new Date()): string {
  return toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// A random key makes the checkout request safe to repeat (the backend returns the same order)
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
