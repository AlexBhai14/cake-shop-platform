# Testing strategy

| Level | Tool | What it proves | Where | Needs |
|---|---|---|---|---|
| Unit | Jest | Business rules with fakes: state machine, saga steps, idempotency, token rotation, money maths | `backend/*/src/**/*.spec.ts`, `frontend/*/src/**/*.test.ts(x)` (Vitest) | nothing |
| Integration | Jest + Testcontainers | The SQL really works and nothing is oversold when many customers order at the same moment | `backend/inventory-service/test/*.int-spec.ts` | Docker |
| End to end | Jest + Supertest | The whole system through the gateway: security rules, the checkout saga with RabbitMQ, payments, refunds, emails | `tests/e2e` | the running system |

## Why three levels?
Unit tests are fast and pinpoint a bug but use fakes. They cannot show that two real database transactions racing for the last cake behave correctly: the integration test does. Neither shows that five services and RabbitMQ cooperate: the E2E tests do. Each level is slower and broader than the one below.

## Testing asynchronous systems
The saga runs in the background, so E2E tests never `sleep` a fixed time. They poll with `eventually(...)` until the RESULT appears (for example order status CONFIRMED) or a timeout fails the test with the last value.

## Rules for E2E tests
- Every file creates its own category and cake (the shop's seed data is not needed) and deactivates them afterwards.
- New customers per test (unique email), so tests do not interfere.
- They need generous rate limits and `AUTO_PAY_SCENARIO=NONE`; the rate-limit test runs separately with the default limits.
- All payments are simulated.
