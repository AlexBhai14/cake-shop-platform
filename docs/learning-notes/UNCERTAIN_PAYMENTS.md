# Uncertain Payment Outcomes (timeouts) and Refunds

**Problem:** we ask the payment provider to charge a customer and the request times out. The money may or may not have moved.
If we guess "failed" and the charge really happened, the customer paid for nothing. If we guess "success" and it did not, we deliver a free cake.

**What this project does (all MOCK):**
1. Timeout -> payment status `UNKNOWN`, no event is published, the order stays `PENDING_PAYMENT`.
2. A reconciliation job in the payment service asks the (mock) bank again after `RECONCILE_AFTER_SECONDS` and publishes `PaymentSucceeded` or `PaymentFailed`.
3. If nothing resolves it, the order service cancels the order after `PAYMENT_TIMEOUT_MINUTES` and inventory releases the stock.
4. If the payment succeeds AFTER the order was cancelled, the order service sees a CANCELLED order and publishes `RefundRequested`; the payment service refunds it.

**Idempotency:** one payment per order (UNIQUE orderId). Clicking Pay twice returns the stored result and never charges twice.
**Refund rules:** only a SUCCEEDED payment can be refunded, and only once (status becomes REFUNDED).
