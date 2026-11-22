import { OrderStatus } from './shared-types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Waiting for payment',
  CONFIRMED: 'Confirmed',
  ACCEPTED: 'Accepted by bakery',
  PREPARING: 'Being prepared',
  READY_FOR_DISPATCH: 'Ready for dispatch',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  PAYMENT_FAILED: 'Payment failed',
  CANCELLED: 'Cancelled',
};

// The normal path of a healthy order, used by the progress bar
export const PROGRESS_STEPS: OrderStatus[] = [
  'CONFIRMED',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_DISPATCH',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const isFinalStatus = (s: OrderStatus) => s === 'DELIVERED' || s === 'CANCELLED' || s === 'PAYMENT_FAILED';

// Mirrors the backend rule. The backend still enforces it; this only hides a button that would fail.
export const canCustomerCancel = (s: OrderStatus) => s === 'PENDING_PAYMENT' || s === 'CONFIRMED';

export const progressIndex = (s: OrderStatus) => PROGRESS_STEPS.indexOf(s);

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export function statusTone(s: OrderStatus): Tone {
  switch (s) {
    case 'DELIVERED':
      return 'green';
    case 'PENDING_PAYMENT':
      return 'amber';
    case 'CANCELLED':
    case 'PAYMENT_FAILED':
      return 'red';
    case 'CONFIRMED':
    case 'ACCEPTED':
    case 'PREPARING':
    case 'READY_FOR_DISPATCH':
    case 'OUT_FOR_DELIVERY':
      return 'blue';
    default:
      return 'gray';
  }
}

const REASONS: Record<string, string> = {
  OUT_OF_STOCK: 'One of the cakes is out of stock.',
  DELIVERY_SLOT_FULL: 'The delivery slot you chose is full. Please order again with another slot.',
  INVALID_SLOT: 'The delivery slot you chose is not available.',
  PAYMENT_FAILED: 'The payment did not go through.',
  PAYMENT_TIMEOUT: 'We did not receive the payment in time.',
  CUSTOMER_REQUEST: 'You cancelled this order.',
  CANCELLED_BY_ADMIN: 'The shop cancelled this order.',
};

export function cancelReasonText(reason: string | null): string | null {
  if (!reason) return null;
  return REASONS[reason] ?? 'The order was cancelled.';
}
