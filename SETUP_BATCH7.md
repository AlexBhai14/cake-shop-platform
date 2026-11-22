# SETUP GUIDE: Batch 7 (React Admin App)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge, replace when asked).
Replaced files: `docker-compose.yml` and, in the backend: `auth-service` (`auth.service.ts`, `auth.controller.ts`),
`order-service` (`orders.service.ts`, `orders.controller.ts`), `api-gateway` (`rate-limit.config.ts` and its spec).
New backend files: `dto/status.dto.ts`, `auth.admin.spec.ts` (auth), `stats.util.ts`, `orders.stats.spec.ts` (order).
There are NO database changes in this batch (no migrations).

IMPORTANT: written but not executed by me (no internet in my build environment). Send me any error in full.

## 1. Backend changes (the admin app needs them)

Stop and restart each service after its tests pass.

```powershell
cd backend\auth-service
npm test
```
Expected: 3 suites pass (auth.service, roles.guard, auth.admin).

```powershell
cd ..\order-service
npm test
```
Expected: 7 suites pass (the new one is orders.stats).

```powershell
cd ..\api-gateway
npm test
```
Expected: 6 suites pass (rate-limit.config has one more test).
Why the gateway changed: logged-in auth routes such as `/api/auth/admin/users` were counted in the strict "10 per minute per IP" limit of the public auth routes. Now only register, refresh and logout use it.

Restart auth-service, order-service and the gateway (`npm run start:dev`).

## 2. Create the admin account

Auth service `.env` must contain ADMIN_EMAIL and ADMIN_PASSWORD (see `.env.example`). Then:

```powershell
cd ..\auth-service
npm run seed
```

Expected: `Admin account ready: admin@cakeshop.local` (or your email). There is no public admin sign-up.

## 3. Install and test the admin app

```powershell
cd ..\..\frontend\admin-app
Copy-Item .env.example .env
npm install
npm test
```

Expected: 7 test files pass (money, jwt, dates, api, orderFlow, admin, RequireAdmin).

```powershell
npm run build
```

Expected: no TypeScript errors, `dist` folder created.

```powershell
npm run dev
```

Open http://localhost:5174 (the customer app stays on http://localhost:5173).

## 4. Walk through every feature

1. **Security first:** log in with a CUSTOMER account: "This account is not an administrator." Log in with the admin account: the dashboard opens.
2. **Dashboard:** totals, revenue of paid orders, waiting for payment, "to accept", in the kitchen, out for delivery, latest orders.
3. **Categories:** add a category, rename it, hide and show it. (A hidden category disappears from the customer shop.)
4. **Cakes:** create a cake with two variants (flavour, size, regular or eggless, price). It appears in the customer app. Edit a price, stop selling one variant, deactivate the whole cake (it disappears from the shop), activate it again.
5. **Inventory > Stock:** cakes without a number are "Made to order". Click Set on one variant and enter 3: it becomes tracked. Place a customer order for 5 of it: the order is cancelled with the reason out of stock. Use Adjust (add 10, reason "restocked") and History to see every change, including reservations made by orders.
6. **Inventory > Delivery slots:** pick a date, set the capacity of a slot to 1, then order 2 cakes for that slot in the customer app: the order is cancelled (slot full).
7. **Orders:** filter by status, open an order. As the customer, place and pay an order (simulated). In the admin app press the green button step by step: Accept order, Start preparing, Mark ready, Send out for delivery, Mark delivered. Each step sends the customer an email (Mailpit http://localhost:8025) and updates the customer's tracking page.
8. **Cancel and refund:** cancel a CONFIRMED order: stock is released and the payment is refunded (see Payments). The Cancel button is gone once the order is PREPARING.
9. **Customers:** suspend a test customer. Their next login or token refresh fails. Re-activate them. You cannot suspend yourself.
10. **Payments:** list with the MOCK notice; refund a SUCCEEDED payment (only once). A payment with status UNKNOWN (bank timeout simulation) resolves by itself after about 30 seconds.
11. **Emails:** every notification with status SENT, PENDING or FAILED.
12. **Analytics:** orders and revenue per day, orders by status, best-selling cakes. Change the period.
13. **Direct API check:** the customer token must get 403 on admin APIs, for example
    `Invoke-RestMethod http://localhost:3000/api/orders/admin/stats -Headers $h` with a customer header returns 403, and without a token 401.

## 5. Run it in Docker (optional)

```powershell
cd ..\..
docker compose up -d --build admin-app
```

Open http://localhost:5174 .

## Commit

```powershell
git status
git add docker-compose.yml docs frontend backend SETUP_BATCH7.md
git status
git commit -m "feat(admin): add react admin app, admin stats and account status endpoints"
git log --oneline
git push
```

Make sure `git status` shows no `.env`, `node_modules` or `dist` before you commit.
