# Event Contracts (RabbitMQ)

Exchange `cake.events` (topic, durable). Every message is an envelope:

```json
{ "eventId": "uuid", "type": "OrderCreated", "version": 1, "occurredAt": "ISO-UTC", "correlationId": "uuid", "data": { } }
```

`eventId` is unique and is used to detect duplicates. `version` increases only when the shape of `data` changes
(add a new version, keep handling the old one until all producers are updated).

| Event | Routing key | Published by | Consumed by | data |
|---|---|---|---|---|
| OrderCreated | order.created | order | inventory | orderId, userId, items[variantId, quantity], deliveryDate, deliverySlot, totalAmount, currency |
| StockReserved | stock.reserved | inventory | order | orderId |
| StockReservationFailed | stock.reservation_failed | inventory | order | orderId, reason (OUT_OF_STOCK, DELIVERY_SLOT_FULL, INVALID_SLOT) |
| StockReleased | stock.released | inventory | (notification, later) | orderId |
| PaymentRequested | payment.requested | order | payment | orderId, userId, amount, currency, email |
| PaymentSucceeded | payment.succeeded | payment | order | orderId, paymentId |
| PaymentFailed | payment.failed | payment | order | orderId, reason |
| RefundRequested | refund.requested | order | payment | orderId, paymentId, reason |
| RefundProcessed | refund.processed | payment | notification | orderId, userId, paymentId, amount, email |
| OrderConfirmed | order.confirmed | order | inventory, notification | orderId, userId, email |
| OrderCancelled | order.cancelled | order | inventory, payment, notification | orderId, userId, reason, email |
| OrderStatusChanged | order.status_changed | order | notification | orderId, userId, status, email |
| OrderShipped | order.shipped | order | notification | orderId, userId, email |

Queues: `inventory.events`, `order.events`. Each has `<queue>.retry` (waits RETRY_DELAY_MS, then returns the message)
and `<queue>.dlq` (dead letter queue after 3 failed attempts). Exchange `cake.retry` returns delayed messages to the main queue.

Queues added in Batch 5: `payment.events`, `notification.events` (each with `.retry` and `.dlq`).
`email` is optional in every event; the version stays 1 because adding an optional field does not break older consumers.
