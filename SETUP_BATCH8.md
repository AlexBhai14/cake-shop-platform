# SETUP GUIDE: Batch 8 (Monitoring, Integration and E2E tests, Kubernetes)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge, replace when asked).
The folder `_tpl` in the zip is only a template folder; you may delete it.

Replaced files: `docker-compose.yml`, `.env.example`, and in EVERY backend service `package.json` and `src/app.module.ts`
(each service got a `/metrics` endpoint). New: `src/metrics/*` in every service, `backend/inventory-service/test/` and `jest.int.config.js`,
`infrastructure/monitoring`, `infrastructure/rabbitmq`, `infrastructure/kubernetes`, `scripts/*.ps1`, `tests/e2e`, three learning notes in `docs/learning-notes`.
There are NO database changes in this batch.

IMPORTANT: written but not executed by me (no internet in my build environment). Send me any error in full.

## Part A: metrics in every service

In EACH of the 9 backend folders run (then restart the service with `npm run start:dev`):

```powershell
npm install
npm test
```

Expected number of passing test suites: api-gateway 7, auth-service 4, user-service 3, product-service 3, cart-service 3,
inventory-service 6, order-service 8, payment-service 6, notification-service 6.

Check one service: http://localhost:3001/metrics shows text lines such as `http_requests_total` and `process_cpu_user_seconds_total`.

## Part B: integration test with a real MySQL (Testcontainers)

Docker Desktop must be running. The first run downloads the `mysql:8.4` image.

```powershell
cd backend\inventory-service
npm run test:int
```

Expected: 1 suite, 5 tests pass: 20 customers race for 5 cakes and exactly 5 win, slot capacity under concurrency, rollback of a failed reservation, idempotent reservation, confirm and release.
This is the test that proves the "no overselling" rule with a real database.

## Part C: monitoring (Prometheus and Grafana)

1. Add this line to the root `.env` (the file you copied from `.env.example`):

```
GRAFANA_ADMIN_PASSWORD=ChangeMeGrafana123
```

2. Start the monitoring containers. RabbitMQ is recreated once to enable its Prometheus plugin (its data volume is kept; the services reconnect by themselves):

```powershell
docker compose up -d rabbitmq prometheus grafana
```

3. Open Prometheus: http://localhost:9090/targets
   Every service that is running shows UP (they run on your PC, Prometheus reaches them through `host.docker.internal`). RabbitMQ shows UP too.
   If all your services run as Docker containers, set `PROMETHEUS_CONFIG=./infrastructure/monitoring/prometheus/prometheus.yml` in `.env` and run the command again.
4. Open Grafana: http://localhost:3030 (user `admin`, password from `.env`). Dashboards > Cake Shop > Cake Shop Overview.
5. Make traffic: use the customer app, or run the E2E tests (Part D). Watch the request rate, latency and orders per minute move.
6. Alerts: http://localhost:9090/alerts . Stop the order service (Ctrl+C). After about one minute `ServiceDown` is FIRING. Start it again and the alert clears.
7. Saga health: stop RabbitMQ (`docker stop cake-rabbitmq`), place an order in the customer app, and watch `outbox_pending_events` grow in Grafana. Start RabbitMQ again: the number drops to 0 and the order continues. No event was lost. This is the transactional outbox at work.

## Part D: end-to-end tests (the whole system through the gateway)

Before you run them:
- Everything is running: infrastructure, all 9 backend services, Mailpit.
- The admin account exists (`npm run seed` in the auth service).
- Payment service `.env`: `AUTO_PAY_SCENARIO=NONE`.
- Gateway `.env`: raise the limits for the test run (the tests register many users from one IP), then restart the gateway:

```
RATE_LOGIN_LIMIT=1000
RATE_AUTH_LIMIT=1000
RATE_USER_LIMIT=5000
RATE_PUBLIC_LIMIT=5000
RATE_ADMIN_LIMIT=5000
```

```powershell
cd tests\e2e
Copy-Item .env.example .env
npm install
npm test
```

Edit `.env` first: admin email and password, and `E2E_LOGIN_LIMIT=1000`.

Expected: 5 suites pass (auth, authorization, catalog, checkout, notifications), roughly 45 tests, in 2 to 4 minutes.
The checkout suite runs the saga for real: happy path, idempotency, price snapshot, failed payment, out of stock, full slot, refund, admin cancel.

The slow test (about 1 minute, simulates a bank timeout and the reconciliation job):

```powershell
npm run test:timeout
```

The rate-limit test: restore the DEFAULT limits in the gateway `.env` (remove the 5 lines above), restart the gateway, set `E2E_LOGIN_LIMIT=5` in `tests\e2e\.env`, wait one minute, then:

```powershell
npm run test:ratelimit
```

Expected: 2 tests pass (a 429 with Retry-After appears after the 5th wrong login).

The tests leave some data behind (deactivated E2E cakes and categories, a few unpaid orders that the system cancels by itself after 15 minutes). That is harmless.

## Part E: Kubernetes (Docker Desktop cluster)

Read `docs/learning-notes/KUBERNETES.md` first (10 minutes).

0. Memory: Docker Desktop > Settings > Resources: set Memory to at least 8 GB (your docker info showed 3.7 GB, which is too small for 11 services plus MySQL and RabbitMQ). Apply and restart. Also stop the services that run on your PC and the compose apps, to free the ports and memory (keep Docker Desktop and Kubernetes running).
1. Check the cluster:

```powershell
kubectl config current-context
kubectl get nodes
```

2. Build the images (the first build takes several minutes):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-images.ps1
```

3. Copy the images into the cluster:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\load-images-to-k8s.ps1
```

If the node name is not `desktop-control-plane`, pass it: `-Node <name>` (it is the name in `kubectl get nodes`).

4. Create the Secret from your `.env` (passwords never enter Git):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\create-k8s-secret.ps1
```

5. Deploy everything:

```powershell
kubectl apply -k infrastructure/kubernetes/overlays/local
kubectl get pods -n cake-shop -w
```

Stop watching with Ctrl+C when every pod is `1/1 Running`. MySQL starts first and creates the 8 databases; services stay "not ready" until it is up (probes!). Each service applies its own Prisma migrations at start (the images contain your `prisma/migrations` folders).
If a pod is not ready: `kubectl describe pod <name> -n cake-shop` and `kubectl logs <name> -n cake-shop`.

6. Create the admin and the demo cakes in the cluster database. Open a SECOND PowerShell window and keep this running:

```powershell
kubectl port-forward -n cake-shop svc/mysql 3307:3306
```

In the first window (replace PASSWORD with the passwords from your `.env`):

```powershell
cd backend\auth-service
$env:DATABASE_URL = "mysql://auth_user:PASSWORD@localhost:3307/cake_auth_db"
npm run seed
cd ..\product-service
$env:DATABASE_URL = "mysql://product_user:PASSWORD@localhost:3307/cake_product_db"
npm run seed
Remove-Item Env:DATABASE_URL
cd ..\..
```

7. Open the shop. Each command needs its own PowerShell window:

```powershell
kubectl port-forward -n cake-shop svc/api-gateway 3000:3000
kubectl port-forward -n cake-shop svc/customer-app 5173:80
kubectl port-forward -n cake-shop svc/admin-app 5174:80
kubectl port-forward -n cake-shop svc/mailpit 8026:8025
```

Customer app http://localhost:5173, admin app http://localhost:5174, emails http://localhost:8026. Place an order, pay (simulated), and watch the emails arrive.
(The React apps were built with the API address http://localhost:3000, so keep the gateway forward on port 3000.)

8. Experiments (this is where you learn Kubernetes):

Self-healing: delete a pod and watch Kubernetes create a new one. The checkout keeps working because events wait in the outbox and in RabbitMQ.

```powershell
kubectl delete pod -n cake-shop -l app=order-service
kubectl get pods -n cake-shop -w
```

A BAD rolling update that Kubernetes protects you from (maxUnavailable 0: the old pod keeps serving) and the rollback:

```powershell
kubectl set image deployment/customer-app customer-app=cake-customer-app:broken -n cake-shop
kubectl get pods -n cake-shop
kubectl rollout status deployment/customer-app -n cake-shop --timeout=30s
```

The new pod shows `ErrImagePull`/`ImagePullBackOff`, but http://localhost:5173 still works (the old pod is still Ready). Go back:

```powershell
kubectl rollout undo deployment/customer-app -n cake-shop
kubectl rollout history deployment/customer-app -n cake-shop
```

Readiness vs liveness: take the database away and watch the services become NOT READY (no traffic) without being restarted:

```powershell
kubectl scale statefulset/mysql -n cake-shop --replicas=0
kubectl get pods -n cake-shop
kubectl scale statefulset/mysql -n cake-shop --replicas=1
```

Logs and details:

```powershell
kubectl logs deployment/order-service -n cake-shop --tail 30
kubectl describe deployment api-gateway -n cake-shop
kubectl get events -n cake-shop --sort-by=.lastTimestamp
```

9. Optional: autoscaling (needs the metrics-server):

```powershell
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch -n kube-system deployment metrics-server --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl apply -f infrastructure/kubernetes/optional/hpa.yaml
kubectl top pods -n cake-shop
kubectl get hpa -n cake-shop
```

10. The Ingress (`base/ingress.yaml`) is included but only works after you install an ingress controller. On Docker Desktop that needs extra port settings, so it is optional; use `port-forward` as above.

11. Clean up everything (this deletes the cluster data too):

```powershell
kubectl delete namespace cake-shop
```

## Commit

```powershell
git status
git add docker-compose.yml .env.example backend infrastructure scripts tests docs SETUP_BATCH8.md
git status
git commit -m "feat(ops): add prometheus metrics, grafana, e2e and integration tests, kubernetes manifests"
git log --oneline
git push
```

Make sure `git status` shows no `.env`, `node_modules`, `dist` or `coverage` before you commit.
