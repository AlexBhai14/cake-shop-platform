# RUN ME FIRST: set up and run the whole project in VS Code

Everything you need, in order. Time needed for the first run: about 30 to 40 minutes (mostly downloads).

> Payments in this project are SIMULATED. No real money is processed.
> The code was written without being executed by the author's tooling. Every step below tells you what you should see; if something differs, copy the full error and ask for a fix.

## 0. What you need installed
Docker Desktop (running), Node.js 22 or newer, Git, VS Code. (You already verified these in Phase 1.)
Docker Desktop memory: at least 4 GB for this guide (8 GB if you also try Kubernetes).

## 1. Open the project
Extract the zip, then in PowerShell:

```powershell
cd path\to\cake-shop-platform
code .
```

## 2. Create your `.env` and set the passwords

```powershell
Copy-Item .env.example .env
```

Open `.env` in VS Code. For local development the sample values work; change them if you want (use letters and digits only).
Add the line `GRAFANA_ADMIN_PASSWORD=...` if it is missing (monitoring only).

## 3. Start the infrastructure (MySQL, Redis, RabbitMQ, Mailpit)

```powershell
docker compose up -d mysql redis rabbitmq mailpit
docker compose ps
```

Wait about one minute until mysql, redis and rabbitmq show `healthy`. MySQL creates the 8 databases and users on its first start.

## 4. One-time setup of all services

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
```

This creates each service's `.env`, installs the packages (several minutes), creates the database tables (`prisma migrate`), the admin account and the demo cakes.
Default admin login (from `backend\auth-service\.env`): `admin@cakeshop.local` / `ChangeMeAdmin123`. Change it in that file BEFORE running the script if you like.

If you get a Prisma or "access denied" error: check that MySQL is `healthy` and that the passwords in the root `.env` were not changed after the first start (if they were, reset with `docker compose down -v` and start again; this deletes the data).

## 5. Start everything

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

## 6. Try the shop (5 minutes)

1. Open http://localhost:5173, register a customer, open a cake, add it to the cart.
2. Checkout: add an address, pick a date (tomorrow or later) and a slot, place the order.
3. On the payment page press **Pay now (simulate success)**. The order becomes Confirmed. Open http://localhost:8025: the confirmation email is there.
4. Open http://localhost:5174, log in as the admin, open the order and press the green buttons (Accept, Start preparing, ...). Watch the customer's tracking page change.

## 7. Run the tests

| Test | Command | Needs |
|---|---|---|
| Unit tests of a service | in `backend\<service>`: `npm test` | nothing |
| Unit tests of a React app | in `frontend\<app>`: `npm test` | nothing |
| Integration (real MySQL) | in `backend\inventory-service`: `npm run test:int` | Docker |
| End to end | in `tests\e2e`: see `SETUP_BATCH8.md`, Part D | everything running, higher gateway rate limits |

## 8. Everything in containers instead (optional)

```powershell
docker compose up -d --build
```

Builds and starts all services and both apps in Docker (first build is slow). Ports are the same as above.

## 9. Monitoring, Kubernetes, CI/CD (optional, later)
- Monitoring: `SETUP_BATCH8.md`, Part C (Prometheus http://localhost:9090, Grafana http://localhost:3030).
- Kubernetes: `SETUP_BATCH8.md`, Part E and `docs/learning-notes/KUBERNETES.md`.
- GitHub Actions: `docs/ci-cd/CI_CD.md` (secrets, approval, Docker Hub).

## 10. Git: save your work safely

```powershell
git status
git add .
git status
git commit -m "feat: complete cake shop platform"
git push
```

Before `git add .` check that `git status` does NOT list any `.env` file, `node_modules` or `dist` (the `.gitignore` already blocks them).
Do commit the `prisma\migrations` folders and the `package-lock.json` files: the CI pipeline needs them.

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose` says a variable is missing | Add it to the root `.env` (see `.env.example`) |
| Port already in use (3306, 3000...) | Stop the other program (for example a local MySQL) or change the port in `docker-compose.yml` |
| `Cannot reach the shop server` in the browser | The gateway window is not running or shows an error |
| `Too many requests` (429) | You hit the gateway rate limit; raise `RATE_PUBLIC_LIMIT` in `backend\api-gateway\.env` and restart it |
| Order stays "Reserving your cake..." | Inventory or order service or RabbitMQ is not running. Check their windows and http://localhost:15672 |
| No email in Mailpit | The notification service window shows the error; check `SMTP_HOST=localhost` and that Mailpit runs |
| Payment page 404 for a long time | Same as the order above: the saga needs inventory, order, payment and RabbitMQ |
| `prisma migrate` asks to reset the database | Say no and ask for help (it means the migration history differs from the database) |
| PowerShell blocks scripts | Use the full command with `-ExecutionPolicy Bypass` as shown |

## 12. Where everything is explained

| File | Content |
|---|---|
| `README.md` | Overview and architecture picture |
| `docs/architecture/ARCHITECTURE.md` | Design, saga, decisions |
| `docs/api-documentation/API.md` and `EVENTS.md` | APIs and events |
| `docs/learning-notes/` | Concept notes to revise |
| `docs/project-report/MSC_PROJECT_REPORT.md` | Your report draft (fill in the results) |
| `SETUP_BATCH1.md` ... `SETUP_BATCH9.md` | Detailed verification guide of each part |
