# SETUP: tests, monitoring, end-to-end tests, Kubernetes and CI/CD

This guide starts where `RUN_ME_FIRST.md` ends. Everything here is optional for running the shop, but it is what makes the project cloud-native.
Run the commands from the project root unless a step says otherwise, one command at a time, and check the output before you continue.

## Part A: unit tests of every service

In EACH of the 9 backend folders and in both React apps run:

```powershell
npm install
npm test
```

Every suite must pass. Check one service's metrics after it is running: http://localhost:3001/metrics shows lines such as `http_requests_total`.

## Part B: integration test with a real MySQL (Testcontainers)

Docker Desktop must be running. The first run downloads the `mysql:8.4` image.

```powershell
cd backend\inventory-service
npm run test:int
```

Expected: 20 customers race for 5 cakes and exactly 5 win, slot capacity holds under concurrency, a failed reservation is rolled back, reservations are idempotent, confirm and release work.
This is the test that proves the "no overselling" rule with a real database.

## Part C: monitoring (Prometheus and Grafana)

1. Make sure the root `.env` contains:

```
GRAFANA_ADMIN_PASSWORD=ChangeMeGrafana123
```

2. Start the monitoring containers. RabbitMQ is recreated once to enable its Prometheus plugin (its data volume is kept):

```powershell
docker compose up -d rabbitmq prometheus grafana
```

3. Open Prometheus: http://localhost:9090/targets. Every service that is running shows UP (they run on your PC; Prometheus reaches them through `host.docker.internal`). RabbitMQ shows UP too.
   If all your services run as Docker containers, set `PROMETHEUS_CONFIG=./infrastructure/monitoring/prometheus/prometheus.yml` in `.env` and run the command again.
4. Open Grafana: http://localhost:3030 (user `admin`, password from `.env`). Dashboards > Cake Shop > Cake Shop Overview.
5. Make traffic with the customer app or the end-to-end tests (Part D) and watch the request rate, latency and orders per minute move.
6. Alerts: http://localhost:9090/alerts. Stop the order service (`Ctrl+C`). After about one minute `ServiceDown` is FIRING. Start it again and the alert clears.
7. Saga health: stop RabbitMQ (`docker stop cake-rabbitmq`), place an order, and watch `outbox_pending_events` grow in Grafana. Start RabbitMQ again: the number drops to 0 and the order continues. No event is lost. This is the transactional outbox at work.

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

Edit `tests\e2e\.env` first: admin email and password, and `E2E_LOGIN_LIMIT=1000`.
The checkout suite runs the saga for real: happy path, idempotency, price snapshot, failed payment, out of stock, full slot, refund, admin cancel.

The slow test (about 1 minute, simulates a bank timeout and the reconciliation job):

```powershell
npm run test:timeout
```

The rate-limit test: restore the DEFAULT limits in the gateway `.env` (remove the 5 lines above), restart the gateway, set `E2E_LOGIN_LIMIT=5` in `tests\e2e\.env`, wait one minute, then:

```powershell
npm run test:ratelimit
```

Expected: a 429 with `Retry-After` appears after the 5th wrong login.
The tests leave some data behind (deactivated E2E cakes and categories, a few unpaid orders that the system cancels by itself after 15 minutes). That is harmless.

## Part E: Kubernetes (Docker Desktop cluster)

Read `docs/learning-notes/KUBERNETES.md` first (10 minutes). The manifests are in `infrastructure/kubernetes` (Kustomize: `base` plus the `local` overlay).

**Why:** self-healing (a crashed pod is replaced), rolling updates without downtime (the new pod must be ready before the old one stops) with a one-command rollback,
scaling, and configuration and secrets kept outside the images. **Cost:** more memory and more moving parts than Docker Compose.

0. Memory: Docker Desktop > Settings > Resources: Memory at least 8 GB. Enable Kubernetes in Docker Desktop (Settings > Kubernetes). Stop the services that run on your PC and the compose apps, to free the ports and memory (keep Docker Desktop and Kubernetes running).
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

If the node name is not `desktop-control-plane`, pass it: `-Node <name>` (the name shown by `kubectl get nodes`).

4. Create the Secret from your `.env` (passwords never enter Git):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\create-k8s-secret.ps1
```

5. Deploy everything:

```powershell
kubectl apply -k infrastructure/kubernetes/overlays/local
kubectl get pods -n cake-shop -w
```

Stop watching with `Ctrl+C` when every pod is `1/1 Running`. MySQL starts first and creates the 8 databases; services stay "not ready" until it is up (probes).
Each service applies its own Prisma migrations when it starts (the images contain the `prisma/migrations` folders, so they must be committed).
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

Customer app http://localhost:5173, admin app http://localhost:5174, emails http://localhost:8026.
(The React apps were built with the API address http://localhost:3000, so keep the gateway forward on port 3000.)

8. Experiments (this is where you learn Kubernetes):

Self-healing: delete a pod and watch Kubernetes create a new one. The checkout keeps working because events wait in the outbox and in RabbitMQ.

```powershell
kubectl delete pod -n cake-shop -l app=order-service
kubectl get pods -n cake-shop -w
```

A BAD rolling update that Kubernetes protects you from (the old pod keeps serving) and the rollback:

```powershell
kubectl set image deployment/customer-app customer-app=cake-customer-app:broken -n cake-shop
kubectl get pods -n cake-shop
kubectl rollout status deployment/customer-app -n cake-shop --timeout=30s
```

The new pod shows `ErrImagePull` or `ImagePullBackOff`, but http://localhost:5173 still works. Go back:

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

## Part F: updating the cluster after you change the code

Docker Desktop's cluster has its own image store, so after a code change you rebuild, load and restart:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-images.ps1
powershell -ExecutionPolicy Bypass -File scripts\load-images-to-k8s.ps1
kubectl rollout restart deployment -n cake-shop
kubectl rollout status deployment/order-service -n cake-shop
```

A new Prisma migration is applied automatically when the service pod starts (`prisma migrate deploy`). If something goes wrong: `kubectl rollout undo deployment/<name> -n cake-shop`.

## Part G: CI/CD with GitHub Actions

The pipeline already exists in `.github/workflows/ci-cd.yml` (lint, tests, build and push 11 Docker images, approved deployment, smoke test, automatic rollback) and `e2e.yml` (nightly end-to-end run).
Before it can deploy, set up (full details and security notes in `docs/ci-cd/CI_CD.md`):

1. The `package-lock.json` files and the `prisma/migrations` folders are committed.
2. A Docker Hub access token (Read and Write).
3. GitHub secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
4. A GitHub environment named `production` with yourself as required reviewer.
5. For the Docker Desktop cluster: a self-hosted runner on your PC and the repository variable `DEPLOY_RUNNER=self-hosted`. A self-hosted runner executes workflow code on your PC, so read the security warning in `docs/ci-cd/CI_CD.md`.
6. The Kubernetes Secret created once with `scripts\create-k8s-secret.ps1` (the pipeline never sees your passwords).
7. Optional: branch protection on `main` that requires the checks to pass.

Untested code is never deployed: `publish` needs all test jobs, `deploy` needs `publish`, and `deploy` additionally needs your approval.
