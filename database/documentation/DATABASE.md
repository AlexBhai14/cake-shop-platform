# Database Documentation

One MySQL 8.4 server (Docker, persistent volume `mysql-data`). **One database and one user per microservice.**
A service must never read another service's tables and there are no cross-service foreign keys.

| Service | Database | DB user | Shadow DB (Prisma Migrate dev) |
|---|---|---|---|
| auth | cake_auth_db | auth_user | cake_auth_db_shadow |
| user | cake_user_db | user_user | cake_user_db_shadow |
| product | cake_product_db | product_user | cake_product_db_shadow |
| cart | cake_cart_db | cart_user | cake_cart_db_shadow |
| inventory | cake_inventory_db | inventory_user | cake_inventory_db_shadow |
| order | cake_order_db | order_user | cake_order_db_shadow |
| payment | cake_payment_db | payment_user | cake_payment_db_shadow |
| notification | cake_notification_db | notification_user | cake_notification_db_shadow |

Each user has privileges ONLY on its own database and its own shadow database (least privilege).
Databases and users are created by `infrastructure/mysql/init/01-init-databases.sh`, which runs once on an empty volume.
Passwords come from the root `.env` (never committed).

## Implemented databases

## cake_auth_db

**users**: `id` CHAR(36) UUID PK, `email` UNIQUE, `passwordHash` (bcrypt), `role` ENUM(CUSTOMER, ADMIN), `status` ENUM(ACTIVE, SUSPENDED), `createdAt`, `updatedAt`.

**refresh_tokens**: `id` UUID PK, `userId` FK to users (same database only), `tokenHash` CHAR(64) UNIQUE (SHA-256, the raw token is never stored), `expiresAt`, `revokedAt`, `createdAt`.

Rules followed: UUID ids, timestamps in UTC, money (later services) as DECIMAL, migrations version-controlled under `backend/<service>/prisma/migrations`.

## cake_product_db (implemented)

- **categories**: `id` UUID, `name` UNIQUE, `slug` UNIQUE, `description`, `isActive`.
- **cakes**: `id` UUID, `categoryId` FK to categories, `name`, `slug` UNIQUE, `description`, `imageUrl`, `discountPercent` (0 to 90, display only: the shop shows `price / (1 - discount)` crossed out), `isActive` (soft delete).
- **cake_variants**: `id` UUID, `cakeId` FK to cakes, `flavour`, `weightGrams`, `eggless`, `price` DECIMAL(10,2), `isActive`.
  UNIQUE(`cakeId`, `flavour`, `weightGrams`, `eggless`). A variant is the thing a customer actually buys; the cart and order services store the variant id and a price snapshot.

## cake_user_db (implemented)

- **profiles**: `id` UUID, `userId` UNIQUE (id from auth-service, NOT a foreign key), `email` (copy for admin listing), `fullName`, `phone`.
- **addresses**: `id` UUID, `profileId` FK to profiles, `label`, `line1`, `line2`, `city`, `state`, `postalCode`, `country`, `isDefault`.
  Rule enforced in code (in a transaction): at most one default address per profile.

## cake_cart_db (implemented)

- **carts**: `id` UUID, `userId` UNIQUE (id from auth-service, NOT a foreign key), timestamps.
- **cart_items**: `id` UUID, `cartId` FK to carts, `variantId` (id of a product-service variant, NOT a foreign key), `quantity`, `message` (text on the cake).
  UNIQUE(`cartId`, `variantId`). **No price is stored.** The cart asks the product-service for the current price every time, so a stale price can never reach checkout.

## cake_inventory_db (implemented)

- **inventory_items**: `variantId` UNIQUE, `onHand`, `reserved`. `available = onHand - reserved`. A variant with NO row is made-to-order (no stock limit; only slot capacity applies).
- **stock_movements**: history of every change (`onHandDelta`, `reservedDelta`, `reason`, `orderId`).
- **slot_capacities**: UNIQUE(`deliveryDate`, `slot`), `capacity`, `booked`: production/delivery capacity in cakes per day and time slot.
- **reservations** + **reservation_items**: one reservation per order (UNIQUE `orderId`), status RESERVED, CONFIRMED or RELEASED.
- **outbox_events**, **processed_events**: transactional outbox and idempotent-consumer tables (every event-driven service has them).

Overselling is prevented with conditional `UPDATE ... WHERE onHand - reserved >= qty` statements inside a transaction.

## cake_order_db (implemented)

- **orders**: `userId` (no FK), `status` (9 statuses), `totalAmount` DECIMAL(10,2), `deliveryDate`, `deliverySlot`, `deliveryAddress` JSON snapshot, `idempotencyKey` (UNIQUE with `userId`), `paymentId`, `cancelReason`.
- **order_items**: snapshot of cake name, flavour, weight, eggless and **unit price** at order time, quantity, message.
- **order_status_history**: tracking, one row per status change (who and when).
- **outbox_events**, **processed_events**.

## cake_order_db: change in Batch 5

`orders.customerEmail` (nullable) was added so the notification service can send emails without calling other services.
Run `npx prisma migrate dev --name add_customer_email` in `backend/order-service`.

## cake_payment_db (implemented, MOCK)

- **payments**: `orderId` UNIQUE (one payment per order = natural idempotency), `userId`, `customerEmail`, `amount` DECIMAL(10,2), `status` (PENDING, PROCESSING, SUCCEEDED, FAILED, UNKNOWN, REFUNDED, CANCELLED), `gatewayRef`, `failureReason`, `orderDelivered` (set from the OrderStatusChanged=DELIVERED event; a delivered order cannot be refunded).
- **wallets**: one row per customer (`userId` UNIQUE), `balance` DECIMAL(10,2). Refunds are credited here.
- **wallet_transactions**: wallet passbook (CREDIT for refunds, DEBIT when the wallet pays for an order; amount, balanceAfter, orderId, paymentId). UNIQUE(paymentId, type) so one payment is credited only once.
- **payment_transactions**: every CHARGE and REFUND is a new row (type, amount, status SUCCEEDED/FAILED/UNKNOWN). Rows are never overwritten (except UNKNOWN resolved by reconciliation).
- **outbox_events**, **processed_events**.
No card numbers or bank data exist anywhere. This is a simulation.

## cake_notification_db (implemented)

- **notifications**: `eventId` UNIQUE (one notification per event), `userId`, `orderId`, `type`, `toEmail`, `subject`, `bodyText`, `bodyHtml`, `status` (PENDING, SENT, FAILED), `attempts`, `nextAttemptAt`, `lastError`, `sentAt`.
- **processed_events**.
