# SETUP GUIDE: Batch 6 (React Customer App)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge, replace when asked).
Replaced file: `docker-compose.yml` (the customer app was added, nothing removed).

The app talks ONLY to the API Gateway (http://localhost:3000). It uses real backend APIs for everything.
IMPORTANT: written but not executed by me (no internet in my build environment). Send me any error in full.

## 1. Before you start

The whole backend must be running (infrastructure in Docker, then auth, user, product, cart, inventory, order, payment, notification, gateway).
Seed the demo cakes once if you have not yet: in `backend\product-service` run `npm run seed`.
Payment service: keep `AUTO_PAY_SCENARIO=NONE` in its `.env`, so the payment page asks you what to do.

## 2. Install and test the app

```powershell
cd frontend\customer-app
Copy-Item .env.example .env
npm install
npm test
```

Expected: 8 test files pass (money, jwt, variants, orders, dates, api, ProtectedRoute, CakeCard).

Type check and production build:

```powershell
npm run build
```

Expected: TypeScript reports no errors and Vite creates the `dist` folder.

## 3. Run it

```powershell
npm run dev
```

Open http://localhost:5173

## 4. Walk through every feature

1. **Home:** categories and popular cakes appear (from the product service).
2. **Cakes:** search ("velvet"), choose a category, tick "Eggless only", set a max price, use the pagination.
3. **Cake detail:** change flavour, size and Regular/Eggless: the price changes. Write a message on the cake.
4. **Add to cart while logged out:** you are sent to Login and brought back after logging in.
5. **Sign up** with a new email (password at least 8 characters). You are logged in automatically.
6. **Cart:** change quantities with + and -, remove a cake. The number on the cart icon follows.
7. **Checkout:** add an address, choose a date (tomorrow or later) and a slot. Slots without enough capacity are disabled. Place the order.
8. **Payment page** (shows a SIMULATED PAYMENT notice): it first says "Reserving your cake and delivery slot", then shows three buttons:
   - **Pay now:** order becomes Confirmed, tracking page opens, Mailpit (http://localhost:8025) receives "Order confirmed".
   - **Declined payment:** order shows Payment failed with the reason, stock and slot are released, Mailpit gets an email.
   - **Bank timeout:** "We are checking again..."; after about 45 seconds the order confirms by itself.
9. **My orders / order tracking:** the status updates every few seconds. Cancel works while the order is Waiting for payment or Confirmed (a paid order is refunded; see the email).
10. **Profile:** change name and phone, add, edit, delete addresses, set a default.
11. **Reload the page** while logged in: you stay logged in (refresh token). Logout works.
12. **Open http://localhost:5173/orders while logged out:** you are sent to Login.
13. **Token refresh:** the access token lasts 15 minutes. After that the app refreshes it silently (no logout).
14. **Admin moves the order** (use the admin PowerShell commands from Batch 4 to set ACCEPTED, PREPARING ...): the customer's tracking page shows the new status and the progress bar moves.

If a page shows "Too many requests", you hit the gateway rate limit. Raise `RATE_PUBLIC_LIMIT` in the gateway `.env` while developing.

## 5. Run it in Docker (optional)

```powershell
cd ..\..
docker compose up -d --build customer-app
```

Open http://localhost:5173 . The API address is baked into the build (`VITE_API_URL`, default http://localhost:3000).

## Commit

```powershell
git status
git add docker-compose.yml docs frontend SETUP_BATCH6.md
git status
git commit -m "feat(frontend): add react customer app"
git log --oneline
git push
```

Make sure `git status` shows no `.env` file and no `node_modules` or `dist` folder before you commit (`.gitignore` already blocks them).
