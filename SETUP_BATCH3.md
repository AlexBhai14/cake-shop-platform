# SETUP GUIDE: Batch 3 (Cart Service and API Gateway)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge). Replaced files: `docker-compose.yml` and `database/documentation/DATABASE.md` (new content added, nothing removed).

Ports: gateway 3000, auth 3001, user 3002, product 3003, cart 3004.

IMPORTANT: written but not executed by me (no internet in my build environment). Send me any error in full.

## A. Cart Service

```powershell
cd backend\cart-service
Copy-Item .env.example .env
```

Edit `.env`: put the real CART_DB_PASSWORD (from the root `.env`) in both URLs, and the same JWT secret as the other services.

```powershell
npm install
npx prisma migrate dev --name init
npm test
npm run start:dev
```

Expected: 2 suites pass (cart.service and roles.guard).

## B. API Gateway

```powershell
cd ..\api-gateway
Copy-Item .env.example .env
```

Edit `.env`: only JWT_ACCESS_SECRET must match the other services (same value). The rest works as written.

```powershell
npm install
npm test
npm run start:dev
```

Expected: 6 suites pass (routes, rate-limit.config, rate-limit.service, token.service, proxy.service, correlation-id).

Keep these running in separate terminals: auth (3001), user (3002), product (3003), cart (3004), gateway (3000), and the Docker infrastructure.

## C. Try everything through the gateway only

Health: http://localhost:3000/health and http://localhost:3000/health/ready (shows Redis status)

```powershell
Invoke-RestMethod http://localhost:3000/api/cakes
```

Login through the gateway and save the token:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"email":"customer@example.com","password":"Password123"}'
```

Get a variant id from the product list, add it to the cart, and view the cart:

```powershell
$cakes = Invoke-RestMethod http://localhost:3000/api/cakes
$variantId = $cakes.items[0].variants[0].id
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Method Post http://localhost:3000/api/cart/items -Headers $h -ContentType 'application/json' -Body (@{ variantId = $variantId; quantity = 2; message = 'Happy Birthday' } | ConvertTo-Json)
Invoke-RestMethod http://localhost:3000/api/cart -Headers $h
```

Expected: the cart shows the current price, a line total, and a subtotal.

Security checks:

```powershell
Invoke-RestMethod http://localhost:3000/api/cart
```
Expected: 401 (no token).

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/categories -Headers $h -ContentType 'application/json' -Body '{"name":"Hack"}'
```
Expected: 403 (customer is not ADMIN; the product-service rejects it).

Rate limit test (login allows 5 per minute per IP, the 6th and later must return 429):

```powershell
1..7 | ForEach-Object { try { Invoke-WebRequest -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"email":"x@y.com","password":"wrongpass1"}' -UseBasicParsing | Out-Null } catch { $_.Exception.Response.StatusCode.value__ } }
```
Expected output: 401 five times, then 429 twice.

Correlation id: every response has an `X-Correlation-Id` header; the same id appears in the gateway log lines.

## D. Everything in Docker (optional)

```powershell
cd ..\..
docker compose up -d --build cart-service api-gateway
docker compose ps
```

## Commit

Commit the new `prisma/migrations` folder of cart-service too.

```powershell
git status
git add docker-compose.yml database backend docs SETUP_BATCH3.md
git status
git commit -m "feat(gateway): add api gateway with redis rate limiting and cart service"
git log --oneline
git push
```

Make sure `git status` shows no `.env` file before you commit.
