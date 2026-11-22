# SETUP GUIDE: Batch 5 (Payment Service MOCK and Notification Service)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge, replace when asked).
The folder `_tpl` in the zip is only a template folder; you may delete it.

Replaced files: `docker-compose.yml`, `database/documentation/DATABASE.md`, `docs/api-documentation/EVENTS.md`,
in `backend/api-gateway`: `src/config/routes.ts`, `routes.spec.ts`, `src/gateway/gateway.controller.ts`, `.env.example`;
in `backend/order-service`: `prisma/schema.prisma`, `src/orders/orders.service.ts`, `order.saga.ts`, `order.saga.spec.ts`, `reconciliation.service.ts`;
and `src/messaging/events.ts` in the inventory-service and order-service.

Ports: gateway 3000, auth 3001, user 3002, product 3003, cart 3004, inventory 3005, order 3006, payment 3007, notification 3008.

IMPORTANT: PAYMENTS ARE SIMULATED. No real money, card or bank is involved anywhere.
Also: written but not executed by me (no internet in my build environment). Send me any error in full.

## 1. Order service: one new column

The order now stores the customer email (needed for emails). Stop the order service, then:

```powershell
cd backend\order-service
npx prisma migrate dev --name add_customer_email
npm test
npm run start:dev
```

Expected: the migration adds `customerEmail`, 6 suites pass. (Old test orders have no email, so they get no emails. That is fine.)

## 2. Gateway

Add these lines to `backend\api-gateway\.env`:

```
PAYMENT_SERVICE_URL=http://localhost:3007
NOTIFICATION_SERVICE_URL=http://localhost:3008
```

Run `npm test` in `backend\api-gateway` and restart it.
Inventory service: restart it too (it uses the updated event contract).

## 3. Payment Service

```powershell
cd ..\payment-service
Copy-Item .env.example .env
```

Edit `.env`: PAYMENT_DB_PASSWORD in both URLs, the same JWT secret, the RabbitMQ password. Leave `AUTO_PAY_SCENARIO=NONE` for now.

```powershell
npm install
npx prisma migrate dev --name init
npm test
npm run start:dev
```

Expected: 5 suites pass (idempotency, outbox.publisher, payments.service, payments.saga, roles.guard).

## 4. Notification Service

```powershell
cd ..\notification-service
Copy-Item .env.example .env
```

Edit `.env` the same way (NOTIFICATION_DB_PASSWORD).

```powershell
npm install
npx prisma migrate dev --name init
npm test
npm run start:dev
```

Expected: 5 suites pass (idempotency, templates, notifications.saga, email.dispatcher, roles.guard).

Open Mailpit (the local test inbox): http://localhost:8025

## 5. Test the full checkout (now with a real payment step)

Prepare as in Batch 4 (login, address, cart item, `$date`, `$h`). Then checkout with a NEW Idempotency-Key:

```powershell
$body = @{ addressId = $addr.id; deliveryDate = $date; deliverySlot = '10:00-12:00' } | ConvertTo-Json
$h2 = @{ Authorization = "Bearer $($login.accessToken)"; 'Idempotency-Key' = [guid]::NewGuid().ToString() }
$order = Invoke-RestMethod -Method Post http://localhost:3000/api/orders/checkout -Headers $h2 -ContentType 'application/json' -Body $body
```

Wait 3 seconds: the stock was reserved and the payment service created a PENDING payment.

```powershell
Invoke-RestMethod "http://localhost:3000/api/payments/orders/$($order.id)" -Headers $h
```

Expected: `status PENDING` and a `notice` saying no real money is processed.

### A. Successful payment

```powershell
Invoke-RestMethod -Method Post "http://localhost:3000/api/payments/orders/$($order.id)/pay" -Headers $h -ContentType 'application/json' -Body '{"scenario":"SUCCESS"}'
```

Wait 3 seconds, then check the order (`CONFIRMED`) and Mailpit (email "Order confirmed"):

```powershell
(Invoke-RestMethod "http://localhost:3000/api/orders/$($order.id)" -Headers $h).status
```

Click Pay again with the same command: the payment is NOT charged twice (the transaction list still has one CHARGE).

### B. Failed payment (new order)

Create another order, then pay with `{"scenario":"FAILURE"}`.
Expected: order `PAYMENT_FAILED`, the slot capacity is released (check `/api/inventory/slots`), and Mailpit shows "Payment failed, order cancelled".

### C. Timeout (uncertain outcome)

Create another order, pay with `{"scenario":"TIMEOUT"}`.
Expected: payment `UNKNOWN`, order still `PENDING_PAYMENT`. After about 45 seconds the reconciliation job asks the mock bank (default: succeeded), the order becomes `CONFIRMED` and the email arrives.

### D. Refund

Cancel the confirmed order from A:

```powershell
Invoke-RestMethod -Method Post "http://localhost:3000/api/orders/$($order.id)/cancel" -Headers $h
```

Expected: order `CANCELLED`, payment `REFUNDED` with a REFUND transaction, stock released, two emails (order cancelled, refund processed).
(Customers can cancel only while the order is PENDING_PAYMENT or CONFIRMED.)

### E. Automatic payments (optional, useful for the frontend demo)

Set `AUTO_PAY_SCENARIO=SUCCESS` in `backend\payment-service\.env` and restart it. Now every checkout is paid automatically.

### F. Security checks

```powershell
# another customer paying for this order: expect 403
Invoke-RestMethod -Method Post "http://localhost:3000/api/payments/orders/$($order.id)/pay" -Headers $otherHeaders -ContentType 'application/json' -Body '{}'
# customer on an admin route: expect 403
Invoke-RestMethod "http://localhost:3000/api/payments/admin/all" -Headers $h
# admin can list payments and notifications
Invoke-RestMethod "http://localhost:3000/api/payments/admin/all" -Headers $ah
Invoke-RestMethod "http://localhost:3000/api/notifications/admin/all" -Headers $ah
# a customer sees only their own notifications
Invoke-RestMethod "http://localhost:3000/api/notifications" -Headers $h
```

### G. Resilience (optional)

Stop the Mailpit container (`docker stop cake-mailpit`), make a successful payment, then start it again (`docker start cake-mailpit`).
The notification is saved as PENDING first, so the email still arrives after Mailpit is back (retries after 30 s, 60 s ...).

RabbitMQ dashboard: http://localhost:15672 > Queues: the `.dlq` queues should be empty.

## 6. Everything in Docker (optional)

```powershell
cd ..\..
docker compose up -d --build payment-service notification-service
docker compose ps
```

## Commit

Commit the new `prisma/migrations` folders (order: new migration; payment and notification: init).

```powershell
git status
git add docker-compose.yml database backend docs SETUP_BATCH5.md
git status
git commit -m "feat(payments): add mock payment and notification services, customer email in orders"
git log --oneline
git push
```

Make sure `git status` shows no `.env` file before you commit.
