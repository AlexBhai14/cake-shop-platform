# REST API Reference

Base URL (local): `http://localhost:3000/api` (the API Gateway). Send `Content-Type: application/json`.
Protected routes need `Authorization: Bearer <accessToken>`. Every response has an `X-Correlation-Id` header.

**Error format** (all errors produced by the gateway): `{ "statusCode": 403, "message": "...", "path": "/api/...", "correlationId": "...", "timestamp": "..." }`.
Validation errors return 400 with a list of messages. Money values are strings with two decimals (`"549.00"`), never floating point numbers.

| Status | Meaning |
|---|---|
| 400 | Invalid input |
| 401 | Missing, invalid or expired token |
| 403 | Logged in, but not allowed (wrong role or somebody else's data) |
| 404 | Not found |
| 409 | Conflict (duplicate, invalid status change, already processed) |
| 429 | Rate limit exceeded (`Retry-After` header) |
| 502 / 504 | A service is unavailable / timed out |

## Auth

| Method and path | Access | Purpose |
|---|---|---|
| POST `/auth/register` `{email, password(8-72)}` | public | Create a CUSTOMER account (201) |
| POST `/auth/login` `{email, password}` | public | Returns `{accessToken, refreshToken, tokenType}` |
| POST `/auth/refresh` `{refreshToken}` | public | New token pair. The old refresh token stops working. Reusing an old one revokes every session |
| POST `/auth/logout` `{refreshToken}` | public | Revokes the refresh token |
| GET `/auth/me` | logged in | The token's user |
| GET `/auth/admin/users?page&limit` | ADMIN | Accounts |
| PATCH `/auth/admin/users/:id/status` `{status: ACTIVE or SUSPENDED}` | ADMIN | Suspend (revokes refresh tokens) or re-activate |

Admin accounts cannot be created through the API. They are provisioned with `npm run seed` in the auth service.

## Catalogue

| Method and path | Access | Purpose |
|---|---|---|
| GET `/categories` | public | Active categories |
| GET `/cakes?search&categoryId&flavour&eggless&minPrice&maxPrice&page&limit` | public | Active cakes with active variants (max 50 per page) |
| GET `/cakes/:id` | public | One cake |
| GET `/variants/:id` | public | Current price and availability of one variant |
| GET `/categories/admin/all`, POST `/categories`, PATCH `/categories/:id` | ADMIN | Manage categories |
| GET `/cakes/admin/all?page&limit`, POST `/cakes`, PATCH `/cakes/:id` | ADMIN | Manage cakes (`isActive:false` hides a cake) |
| POST `/cakes/:id/variants`, PATCH `/variants/:id` `{price?, isActive?}` | ADMIN | Variants and prices |

Create cake: `{name, description, categoryId, imageUrl?, variants:[{flavour, weightGrams(100-20000), eggless, price(max 2 decimals)}]}`.

## Users

| Method and path | Access | Purpose |
|---|---|---|
| GET `/users/me`, PATCH `/users/me` `{fullName?, phone?}` | logged in | Own profile (created on first use) |
| GET, POST `/users/me/addresses` | logged in | Own addresses (the first one is the default) |
| PATCH `/users/me/addresses/:id`, PATCH `.../:id/default`, DELETE `.../:id` | logged in | Change, set default, delete |
| GET `/users?page&limit` | ADMIN | All profiles |

## Cart

| Method and path | Purpose |
|---|---|
| GET `/cart` | Lines with the CURRENT price, `subtotal`, `hasUnavailableItems` |
| POST `/cart/items` `{variantId, quantity(1-20), message?}` | Add (adds to the quantity of an existing line, max 20) |
| PATCH `/cart/items/:itemId` `{quantity}`, DELETE `/cart/items/:itemId`, DELETE `/cart` | Change, remove, clear |

## Inventory and delivery slots

| Method and path | Access | Purpose |
|---|---|---|
| GET `/inventory/slots?date=YYYY-MM-DD` | logged in | Capacity, booked and free places per slot |
| PUT `/inventory/slots` `{date, slot, capacity}` | ADMIN | Set the capacity of a slot (not below the booked amount) |
| GET `/inventory/items?page&limit` | ADMIN | Tracked stock (`onHand`, `reserved`, `available`) |
| PUT `/inventory/items/:variantId` `{onHand}` | ADMIN | Set stock (starts tracking; untracked variants are made to order) |
| POST `/inventory/items/:variantId/adjustments` `{delta, reason}` | ADMIN | Add or remove stock |
| GET `/inventory/items/:variantId/history` | ADMIN | Every stock movement |

## Orders

| Method and path | Access | Purpose |
|---|---|---|
| POST `/orders/checkout` `{addressId, deliveryDate, deliverySlot}` + header `Idempotency-Key` | customer | Create the order from the cart (201). The same key returns the same order |
| GET `/orders` | customer | Own orders |
| GET `/orders/:id` | owner or ADMIN | Order with items, address snapshot and status history (403 for other customers) |
| POST `/orders/:id/cancel` | owner or ADMIN | Customers: `PENDING_PAYMENT` or `CONFIRMED`. Admin: until `ACCEPTED` |
| GET `/orders/admin/all?status&page&limit` | ADMIN | All orders |
| GET `/orders/admin/stats?days` | ADMIN | Totals, revenue of paid orders, daily buckets, best sellers |
| PATCH `/orders/:id/status` `{status}` | ADMIN | `ACCEPTED`, `PREPARING`, `READY_FOR_DISPATCH`, `OUT_FOR_DELIVERY`, `DELIVERED`. Invalid jumps give 409 |

Checkout rules: the cart must not be empty or contain unavailable cakes; the date must be at least `MIN_LEAD_DAYS` ahead and at most `MAX_ADVANCE_DAYS`; the address must belong to the customer.
Stock and slot are reserved afterwards through events: the order may become `CANCELLED` with `cancelReason` `OUT_OF_STOCK`, `DELIVERY_SLOT_FULL` or `INVALID_SLOT`.

## Payments (MOCK)

| Method and path | Access | Purpose |
|---|---|---|
| GET `/payments/orders/:orderId` | owner or ADMIN | Payment with transactions and a notice that no real money moves. 404 until the stock is reserved |
| POST `/payments/orders/:orderId/pay` `{scenario: SUCCESS, FAILURE or TIMEOUT}` | owner | Simulated payment. Repeating it never charges twice. `TIMEOUT` leaves the status `UNKNOWN` until reconciliation |
| GET `/payments/admin/all?page&limit` | ADMIN | All payments |
| POST `/payments/orders/:orderId/refund` | ADMIN | Mock refund of a `SUCCEEDED` payment (only once). The money is credited to the customer's wallet. A `DELIVERED` order returns 409 |
| GET `/payments/wallet` | CUSTOMER (own wallet) | Wallet balance (`0.00` if no refund yet) |
| GET `/payments/wallet/transactions?page&limit` | CUSTOMER (own wallet) | Wallet history, newest first |

Payment responses include `refundable` (true only for a `SUCCEEDED` payment of an order that is not delivered). The admin UI uses it to show or hide the Refund button.

## Notifications

| Method and path | Access | Purpose |
|---|---|---|
| GET `/notifications` | logged in | Own notifications |
| GET `/notifications/admin/all?status&page&limit` | ADMIN | Email log (`PENDING`, `SENT`, `FAILED`) |

## Health and metrics (not under `/api`)

Every service: `GET /health` (liveness), `GET /health/ready` (database reachable), `GET /metrics` (Prometheus, internal only).
