# RUN ME FIRST: set up, run and stop the whole project in VS Code

Time for the very first run: about 30 to 40 minutes (mostly downloads). After that, starting the project takes about two minutes.

> Payments and the wallet in this project are SIMULATED. No real money is processed.

## 0. What you need installed
Docker Desktop (running), Node.js 22 or newer, Git, VS Code.
Docker Desktop memory: at least 4 GB for this guide (8 GB if you also use Kubernetes, see `SETUP.md`).

## 1. Open the project

```powershell
cd D:\Sahil_Code\Project\cake-shop-platform-FULL\cake-shop-platform
code .
```

(Use your own folder path if it is different.)

## 2. Create your `.env` and set the passwords (first time only)

```powershell
Copy-Item .env.example .env
```

Open `.env` in VS Code. For local development the sample values work; change them if you want (use letters and digits only).
Never commit `.env`: it is ignored by Git.

## 3. Start the infrastructure (MySQL, Redis, RabbitMQ, Mailpit)

```powershell
docker compose up -d mysql redis rabbitmq mailpit
docker compose ps
```

Wait about one minute until `mysql`, `redis` and `rabbitmq` show `healthy`. MySQL creates the 8 databases and users on its first start.
If you start the services before MySQL is healthy you will see `P1001: Can't reach database server`.

## 4. One-time setup of all services (first time only)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
```

This creates each service's `.env`, installs the packages (several minutes), applies the database migrations, and creates the admin account and the demo cakes.
Default admin login (from `backend\auth-service\.env`): `admin@cakeshop.local` / `ChangeMeAdmin123`. Change it in that file BEFORE running the script if you like.

If you get a Prisma or "access denied" error: check that MySQL is `healthy` and that the passwords in the root `.env` were not changed after the first start
(if they were, reset with `docker compose down -v` and start again; this DELETES all data).

## 5. Start everything (every day)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
```

Eleven PowerShell windows open (9 services and 2 React apps). Wait a minute.

| What | URL |
|---|---|
| Customer shop | http://localhost:5173 |
| Admin panel | http://localhost:5174 |
| API gateway health | http://localhost:3000/health |
| Test inbox (emails) | http://localhost:8025 |
| RabbitMQ management | http://localhost:15672 (user and password from `.env`) |

## 6. Try the shop (10 minutes)

1. Open http://localhost:5173, register a customer, open a cake, add it to the cart. A discounted cake shows a crossed-out price; the cart shows "You saved".
2. Checkout: add an address, pick a date (tomorrow or later) and a slot, place the order.
3. On the payment page press **Pay now (simulate success)**. The order becomes Confirmed. Open http://localhost:8025: the confirmation email is there.
4. Open http://localhost:5174 in another browser window and log in as the admin. A pop-up announces the new paid order (it can take up to 15 seconds), and the dashboard shows it under **Recent activity**.
   Open the order and press the green buttons (Accept, Start preparing, ...). Watch the customer's tracking page change.
5. Wallet: cancel a paid order as the customer (or the admin). The refund appears in the customer's **Wallet** page.
   On the next order, the payment page offers **Pay with wallet** when the balance is enough.
6. A delivered order cannot be refunded: the Refund button disappears in the admin panel.
7. Discount: in the admin panel open Cakes, edit a cake, set "Discount shown in the shop (%)" (for example 30) and a real price (for example 70). The shop shows 100 crossed out, 30% OFF and 70.

## 7. Stop the project safely

Stop in this order so that no message or database write is cut in the middle.

1. **Stop the apps.** In each of the 11 PowerShell windows press `Ctrl+C` (answer `Y` if PowerShell asks "Terminate batch job"), then close the window. Do not just power off the laptop.
2. **Stop the infrastructure.** From the project root:

```powershell
docker compose stop
```

This stops the containers and **keeps all data** (users, cakes, orders, wallets). Next time start again from step 3.

| Command | What it does | Data |
|---|---|---|
| `docker compose stop` | Stops containers | Kept |
| `docker compose down` | Stops and removes containers | Kept (volumes stay) |
| `docker compose down -v` | Stops and removes containers **and volumes** | **DELETED** (databases are empty afterwards) |

Use `down -v` only when you really want a clean start. After it you must run step 4 again (tables, admin and demo cakes).

3. Check that nothing is left running:

```powershell
docker compose ps
```

## 8. After pulling new code

If the new code changes a database schema (a new folder appeared in `backend\<service>\prisma\migrations`), run once in that service folder:

```powershell
npx prisma migrate deploy
```

(`npx prisma migrate dev --name <change>` is only for creating a NEW migration while you develop.) Then restart the service.

## 9. Run the tests

| Test | Command | Needs |
|---|---|---|
| Unit tests of a service | in `backend\<service>`: `npm test` | nothing |
| Unit tests of a React app | in `frontend\<app>`: `npm test` | nothing |
| Integration (real MySQL) | in `backend\inventory-service`: `npm run test:int` | Docker |
| End to end | in `tests\e2e`: see `SETUP.md`, Part D | everything running, higher gateway rate limits |

## 10. Everything in containers instead (optional)

```powershell
docker compose up -d --build
```

Builds and starts all services and both apps in Docker (first build is slow). Ports are the same as above.

## 11. Monitoring, Kubernetes, CI/CD (optional)
- Monitoring, end-to-end tests and Kubernetes: `SETUP.md` (Prometheus http://localhost:9090, Grafana http://localhost:3030).
- Kubernetes concepts: `docs/learning-notes/KUBERNETES.md`.
- GitHub Actions: `docs/ci-cd/CI_CD.md` (secrets, approval, Docker Hub).

## 12. Git: save your work safely

Work on a branch, review, then merge:

```powershell
git switch -c feature/my-change
git status
git add <the folders or files you changed>
git status
git commit -m "feat: describe the change"
git switch main
git merge feature/my-change
git push
```

Do not use `git add .` blindly. Before you add, check that `git status` does NOT list any `.env` file, `node_modules` or `dist` (the `.gitignore` already blocks them).
The `prisma\migrations` folders and the `package-lock.json` files MUST be committed: the Docker images and the CI pipeline need them.

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| `P1001: Can't reach database server` | MySQL is not running or not healthy yet: start Docker Desktop, run step 3, wait for `healthy` |
| `docker compose` says a variable is missing | Add it to the root `.env` (see `.env.example`) |
| Port already in use (3306, 3000...) | Stop the other program (for example a local MySQL) or change the port in `docker-compose.yml` |
| `Cannot reach the shop server` in the browser | The gateway window is not running or shows an error |
| `Too many requests` (429) | You hit the gateway rate limit; raise `RATE_PUBLIC_LIMIT` in `backend\api-gateway\.env` and restart it |
| Order stays "Reserving your cake..." | Inventory or order service or RabbitMQ is not running. Check their windows and http://localhost:15672 |
| No email in Mailpit | The notification service window shows the error; check `SMTP_HOST=localhost` and that Mailpit runs |
| Payment page 404 for a long time | Same as the order above: the saga needs inventory, order, payment and RabbitMQ |
| No pop-up for a new order in the admin panel | The pop-up appears for PAID orders, within 15 seconds, and not for orders that already existed when you logged in |
| `prisma migrate` asks to reset the database | Say no and ask for help (it means the migration history differs from the database) |
| PowerShell blocks scripts | Use the full command with `-ExecutionPolicy Bypass` as shown |

## 14. Where everything is explained

| File | Content |
|---|---|
| `README.md` | Overview, architecture picture, recent updates |
| `SETUP.md` | Tests, monitoring, end-to-end tests, Kubernetes, CI/CD |
| `docs/architecture/ARCHITECTURE.md` | Design, saga, decisions |
| `docs/api-documentation/API.md` and `EVENTS.md` | APIs and events |
| `docs/learning-notes/` | Concept notes to revise |
| `docs/project-report/MSC_PROJECT_REPORT.md` | Project report |
