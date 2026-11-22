import { OrderStatus } from './shared-types';

// The next step on the production pipeline. Mirrors the backend state machine
// (the backend still rejects every invalid jump with HTTP 409).
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  CONFIRMED: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY_FOR_DISPATCH',
  READY_FOR_DISPATCH: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

export const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  ACCEPTED: 'Accept order',
  PREPARING: 'Start preparing',
  READY_FOR_DISPATCH: 'Mark ready for dispatch',
  OUT_FOR_DELIVERY: 'Send out for delivery',
  DELIVERED: 'Mark delivered',
};

export const nextStatus = (s: OrderStatus): OrderStatus | null => NEXT_STATUS[s] ?? null;

// An admin may cancel until the bakery has started preparing the cake
export const adminCanCancel = (s: OrderStatus) => s === 'PENDING_PAYMENT' || s === 'CONFIRMED' || s === 'ACCEPTED';
