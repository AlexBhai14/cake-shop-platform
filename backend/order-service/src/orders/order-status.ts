export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_DISPATCH'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export const ALL_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'PAYMENT_FAILED', 'CANCELLED',
];

// The state machine: an order can only move along these arrows. Nothing else is allowed.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED'],
  CONFIRMED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_DISPATCH'],
  READY_FOR_DISPATCH: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  PAYMENT_FAILED: [],
  DELIVERED: [],
  CANCELLED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => TRANSITIONS[from].includes(to);

// Statuses an admin may set by hand. CONFIRMED and PAYMENT_FAILED belong to the payment saga only.
export const ADMIN_TARGETS: OrderStatus[] = [
  'ACCEPTED', 'PREPARING', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
];

// A customer may cancel only before the shop starts working on the cake.
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING_PAYMENT', 'CONFIRMED'];
export const ADMIN_CANCELLABLE: OrderStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'ACCEPTED'];
