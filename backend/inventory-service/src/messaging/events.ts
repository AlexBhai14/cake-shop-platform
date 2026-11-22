// ===== Event contract (versioned). The SAME file is used by every service that sends or receives events. =====
// Exchange "cake.events" is a TOPIC exchange; the routing key of each event is below.
export const EXCHANGE = 'cake.events';
export const RETRY_EXCHANGE = 'cake.retry';

export const ROUTING_KEYS = {
  OrderCreated: 'order.created',
  StockReserved: 'stock.reserved',
  StockReservationFailed: 'stock.reservation_failed',
  StockReleased: 'stock.released',
  PaymentRequested: 'payment.requested',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  RefundRequested: 'refund.requested',
  RefundProcessed: 'refund.processed',
  OrderConfirmed: 'order.confirmed',
  OrderCancelled: 'order.cancelled',
  OrderStatusChanged: 'order.status_changed',
  OrderShipped: 'order.shipped',
} as const;

export type EventType = keyof typeof ROUTING_KEYS;

export interface EventEnvelope<T = any> {
  eventId: string; // unique per event: consumers use it to detect duplicates
  type: EventType;
  version: number; // contract version, increases only when the data shape changes
  occurredAt: string; // ISO timestamp (UTC)
  correlationId: string; // follows one customer action through all services
  data: T;
}

export interface OrderCreatedData {
  orderId: string;
  userId: string;
  items: Array<{ variantId: string; quantity: number }>;
  deliveryDate: string; // YYYY-MM-DD
  deliverySlot: string; // for example 10:00-12:00
  totalAmount: string; // for example 1098.00
  currency: string;
}

export interface DataMap {
  OrderCreated: OrderCreatedData;
  StockReserved: { orderId: string };
  StockReservationFailed: { orderId: string; reason: string };
  StockReleased: { orderId: string };
  PaymentRequested: { orderId: string; userId: string; amount: string; currency: string; email?: string };
  PaymentSucceeded: { orderId: string; paymentId: string };
  PaymentFailed: { orderId: string; reason: string };
  RefundRequested: { orderId: string; paymentId: string; reason: string };
  RefundProcessed: { orderId: string; userId: string; paymentId: string; amount: string; email?: string };
  OrderConfirmed: { orderId: string; userId: string; email?: string };
  OrderCancelled: { orderId: string; userId: string; reason: string; email?: string };
  OrderStatusChanged: { orderId: string; userId: string; status: string; email?: string };
  OrderShipped: { orderId: string; userId: string; email?: string };
}

export function buildEnvelope<K extends EventType>(
  type: K,
  data: DataMap[K],
  correlationId: string,
): EventEnvelope<DataMap[K]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID } = require('crypto');
  return { eventId: randomUUID(), type, version: 1, occurredAt: new Date().toISOString(), correlationId, data };
}
