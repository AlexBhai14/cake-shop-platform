# SETUP GUIDE: Batch 4 (Inventory Service, Order Service, Checkout Saga)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge). Replaced files: `docker-compose.yml`, `database/documentation/DATABASE.md`,
and in `backend/api-gateway`: `src/config/routes.ts`, `src/config/routes.spec.ts`, `src/gateway/gateway.controller.ts`, `.env.example`.
The folder `_tpl` in the zip is only a template folder used to build the services. You may delete it.

Ports: gateway 3000, auth 3001, user 3002, product 3003, cart 3004, inventory 3005, order 3006.

IMPORTANT: written but not executed by me (no internet in my build environment). Send me any error in full.

## 1. Gateway update

Add these two lines to `backend\api-gateway\.env` (your real file, not the example):

```
INVENTORY_SERVICE_URL=http://localhost:3005
ORDER_SERVICE_URL=http://localhost:3006
```

Then in `backend\api-gateway` run `npm test` (the routes tests were extended) and restart the gateway.

## 2. Inventory Service

```powershell
cd backend\inventory-service
Copy-Item .env.example .env
```

Edit `.env`: INVENTORY_DB_PASSWORD in both database URLs, the same JWT secret, and the RabbitMQ password from the root `.env`.

```powershell
npm install
npx prisma migrate dev --name init
npm test
npm run start:dev
```

Expected: 5 suites pass (idempotency, outbox.publisher, reservation.service, inventory.saga, roles.guard). The log shows `rabbitmq connected` and `consumer started`.

## 3. Order Service

```powershell
cd ..\order-service
Copy-Item .env.example .env
```

Edit `.env` the same way (ORDER_DB_PASSWORD).

```powershell
npm install
npx prisma migrate dev --name init
npm test
npm run start:dev
```

Expected: 6 suites pass (idempotency, outbox.publisher, order-status, orders.service, order.saga, roles.guard).

Keep running: infrastructure (Docker), auth, user, product, cart, inventory, order, gateway.

## 4. Test the checkout saga

Login and prepare a cart and an address:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"email":"customer@example.com","password":"Password123"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }
$addr = Invoke-RestMethod -Method Post http://localhost:3000/api/users/me/addresses -Headers $h -ContentType 'application/json' -Body '{"label":"Home","line1":"12 MG Road","city":"Mumbai","state":"Maharashtra","postalCode":"400001"}'
$cakes = Invoke-RestMethod http://localhost:3000/api/cakes
$variantId = $cakes.items[0].variants[0].id
Invoke-RestMethod -Method Post http://localhost:3000/api/cart/items -Headers $h -ContentType 'application/json' -Body (@{ variantId = $variantId; quantity = 2; message = 'Happy Birthday' } | ConvertTo-Json)
```

Check the free slots for a date 5 days from now:

```powershell
$date = (Get-Date).AddDays(5).ToString('yyyy-MM-dd')
Invoke-RestMethod "http://localhost:3000/api/inventory/slots?date=$date" -Headers $h
```

Expected: 4 slots with `capacity 10`, `booked 0`.

Checkout (the Idempotency-Key makes a double click safe):

```powershell
$body = @{ addressId = $addr.id; deliveryDate = $date; deliverySlot = '10:00-12:00' } | ConvertTo-Json
$h2 = @{ Authorization = "Bearer $($login.accessToken)"; 'Idempotency-Key' = 'test-key-001' }
$order = Invoke-RestMethod -Method Post http://localhost:3000/api/orders/checkout -Headers $h2 -ContentType 'application/json' -Body $body
$order.status
```

Expected: `PENDING_PAYMENT`. Run the same checkout command again: you get the SAME order id (no second order).

Wait 3 seconds, then:

```powershell
Invoke-RestMethod "http://localhost:3000/api/inventory/slots?date=$date" -Headers $h
```

Expected: slot `10:00-12:00` shows `booked 2` (the saga reserved capacity through RabbitMQ).

The Payment Service comes in the next batch. Until then we play the payment service by hand through the RabbitMQ management API.
Credentials: user and password from the root `.env` (RABBITMQ_USER, RABBITMQ_PASSWORD).

```powershell
$pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("cake:ChangeMeRabbit123"))
function Publish-Event($key, $json) {
  $payload = @{ properties = @{ delivery_mode = 2; content_type = 'application/json' }; routing_key = $key; payload = $json; payload_encoding = 'string' } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Uri 'http://localhost:15672/api/exchanges/%2F/cake.events/publish' -Headers @{ Authorization = "Basic $pair" } -ContentType 'application/json' -Body $payload
}
$ev = @{ eventId = [guid]::NewGuid().ToString(); type = 'PaymentSucceeded'; version = 1; occurredAt = (Get-Date).ToUniversalTime().ToString('o'); correlationId = 'manual-test-001'; data = @{ orderId = $order.id; paymentId = [guid]::NewGuid().ToString() } } | ConvertTo-Json -Depth 5 -Compress
Publish-Event 'payment.succeeded' $ev
```

Expected output: `routed : True`. Then:

```powershell
(Invoke-RestMethod "http://localhost:3000/api/orders/$($order.id)" -Headers $h).status
```

Expected: `CONFIRMED`. Send the SAME `$ev` again with `Publish-Event` and check again: still CONFIRMED, only one OrderConfirmed (duplicate ignored).

Failure path: create a second order (add to cart again, checkout with another Idempotency-Key), then publish `payment.failed` with `data = @{ orderId = ...; reason = 'CARD_DECLINED' }` and `type = 'PaymentFailed'`.
Expected: order becomes `PAYMENT_FAILED` and the slot `booked` number goes back down (reservation released).

Security and rules:

```powershell
# Another customer must not read this order (register a second customer, login, then call this with that token): expect 403
Invoke-RestMethod "http://localhost:3000/api/orders/$($order.id)" -Headers $otherHeaders
# Customer cannot use admin routes: expect 403
Invoke-RestMethod "http://localhost:3000/api/orders/admin/all" -Headers $h
```

Admin moves the order along (login as admin, `$ah` = admin header):

```powershell
Invoke-RestMethod -Method Patch "http://localhost:3000/api/orders/$($order.id)/status" -Headers $ah -ContentType 'application/json' -Body '{"status":"ACCEPTED"}'
Invoke-RestMethod -Method Patch "http://localhost:3000/api/orders/$($order.id)/status" -Headers $ah -ContentType 'application/json' -Body '{"status":"DELIVERED"}'
```

The second call must fail with 409 (cannot skip from ACCEPTED to DELIVERED).

RabbitMQ dashboard: http://localhost:15672 > Queues. You should see `inventory.events`, `order.events`, each with `.retry` and `.dlq`. The `.dlq` queues should stay at 0 messages.

## 5. Admin stock and slots (optional)

```powershell
Invoke-RestMethod -Method Put "http://localhost:3000/api/inventory/items/$variantId" -Headers $ah -ContentType 'application/json' -Body '{"onHand":3}'
```

Now this variant is tracked: ordering 5 of it makes the saga cancel the order with reason `OUT_OF_STOCK`.

```powershell
Invoke-RestMethod -Method Put http://localhost:3000/api/inventory/slots -Headers $ah -ContentType 'application/json' -Body (@{ date = $date; slot = '12:00-14:00'; capacity = 1 } | ConvertTo-Json)
```

## 6. Everything in Docker (optional)

```powershell
cd ..\..
docker compose up -d --build inventory-service order-service api-gateway
docker compose ps
```

## Commit

Commit the new `prisma/migrations` folders of both services.

```powershell
git status
git add docker-compose.yml database backend docs SETUP_BATCH4.md
git status
git commit -m "feat(checkout): add inventory and order services with saga, outbox and rabbitmq"
git log --oneline
git push
```

Make sure `git status` shows no `.env` file before you commit.
