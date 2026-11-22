import { OrderStatus } from './shared-types';
import { AdminOrder } from './types';

export interface ActivityItem {
  id: string;
  orderId: string;
  text: string;
  amount: string;
  at: string;
  tone: 'green' | 'amber' | 'red' | 'blue' | 'gray';
}

const MESSAGE: Record<OrderStatus, [string, ActivityItem['tone']]> = {
  PENDING_PAYMENT: ['placed, waiting for payment', 'amber'],
  CONFIRMED: ['paid, waiting to be accepted', 'green'],
  ACCEPTED: ['accepted', 'blue'],
  PREPARING: ['is being prepared', 'blue'],
  READY_FOR_DISPATCH: ['is ready for dispatch', 'blue'],
  OUT_FOR_DELIVERY: ['is out for delivery', 'blue'],
  DELIVERED: ['was delivered', 'gray'],
  PAYMENT_FAILED: ['payment failed', 'red'],
  CANCELLED: ['was cancelled', 'red'],
};

// Builds a short "what happened lately" list from the latest orders (newest change first).
export function buildActivity(orders: AdminOrder[], limit = 8): ActivityItem[] {
  return [...orders]
    .sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt))
    .slice(0, limit)
    .map((o) => {
      const [text, tone] = MESSAGE[o.status] ?? [String(o.status).toLowerCase(), 'gray' as const];
      return {
        id: `${o.id}:${o.status}`,
        orderId: o.id,
        text: `Order #${o.id.slice(0, 8).toUpperCase()} ${text}`,
        amount: o.totalAmount,
        at: o.updatedAt ?? o.createdAt,
        tone,
      };
    });
}

// "5 min ago" style label.
export function timeAgo(iso: string, now: number = Date.now()): string {
  const sec = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
