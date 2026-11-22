# Checkout Saga (Orchestration with events)

Why not one big transaction? Orders, stock and payments live in DIFFERENT databases. A saga is a chain of local
transactions; if a step fails, earlier steps are undone by compensating actions.

```
Customer -> POST /orders/checkout
 Order:     create order PENDING_PAYMENT + outbox OrderCreated          (one local transaction)
 Inventory: reserve stock + slot                -> StockReserved | StockReservationFailed
 Order:     StockReserved -> PaymentRequested   | StockReservationFailed -> CANCELLED
 Payment:   (next batch)                        -> PaymentSucceeded | PaymentFailed
 Order:     PaymentSucceeded -> CONFIRMED + OrderConfirmed
            PaymentFailed    -> PAYMENT_FAILED + OrderCancelled
 Inventory: OrderConfirmed -> consume reservation | OrderCancelled -> release reservation (compensation)
```

Reliability building blocks used:
- **Transactional outbox:** the event row is written in the same DB transaction as the business change, so a crash can never save the order but lose the event.
- **At-least-once delivery + idempotent consumers:** a duplicate event is detected through `processed_events` (same transaction as the work).
- **Retry + DLQ:** failed handlers retry after a delay, three times, then the message waits in `<queue>.dlq`.
- **Optimistic status guard:** `UPDATE orders SET status = new WHERE id = ? AND status = old` so two requests cannot both change an order.
- **Reconciliation:** orders still PENDING_PAYMENT after 15 minutes are cancelled; a late payment then triggers a refund request.
- **Idempotency-Key header** on checkout: the same key returns the same order (double-click safe).
