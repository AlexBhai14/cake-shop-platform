# Kubernetes in this project

| Concept | What it is | In this project |
|---|---|---|
| Cluster / node | The machines that run containers | Docker Desktop cluster (one node) |
| Namespace | A folder that groups resources | `cake-shop` |
| Pod | One or more containers that run together (the smallest unit) | one pod per service replica. A Docker container is a single process; a Pod wraps containers with shared network and storage and is what Kubernetes schedules and restarts |
| Deployment | Keeps N pods running and does rolling updates | one per service |
| Service | A stable name and IP in front of changing pods | `http://order-service:3006` works because of the Service |
| ConfigMap | Non-secret settings | `cake-config` |
| Secret | Passwords and keys (base64, NOT encrypted: protect access with RBAC) | `cake-secrets`, created from your local `.env`, never in Git |
| Ingress | HTTP routing from outside into Services by host and path | `ingress.yaml` (needs an ingress controller) |
| Probes | Health checks | startup (can take 150 s for migrations), readiness (receive traffic?), liveness (restart?) |
| Requests / limits | Guaranteed and maximum CPU and memory | set on every container |
| HPA | Adds pods when CPU is high | `optional/hpa.yaml` (needs metrics-server) |
| PVC | A disk that survives pod restarts | MySQL (5 Gi) and RabbitMQ (2 Gi) |

## Rolling updates and rollbacks
`strategy: RollingUpdate, maxUnavailable: 0, maxSurge: 1`: Kubernetes starts the NEW pod first, waits until its readiness probe passes, and only then stops the old one. If the new version never becomes ready, the old pods keep serving and `kubectl rollout undo` goes back.

## Readiness vs liveness
Readiness failing = the pod is removed from the Service (no traffic) but not restarted (for example the database is down). Liveness failing = the container is restarted (the process is stuck). The gateway uses `/health` for readiness because it keeps working without Redis (the rate limiter fails open).

## MySQL: in the cluster or managed? (trade-offs)
| | In-cluster StatefulSet (used here) | Managed database (RDS, Cloud SQL) |
|---|---|---|
| Setup | one YAML file, free | account, network, cost |
| Backups, patches, failover | you do everything | provider does it |
| Performance and scaling | limited by the node | tuned, replicas, bigger machines |
| Good for | learning, demos, CI | production |
To move to a managed database: delete `infra/mysql.yaml`, create the 8 databases and users there, and change the host in the `DATABASE_URL` values of the Deployments.

## Other production notes
Mailpit is a test inbox: use a real SMTP provider. Redis here has no persistence (rate-limit counters only). NetworkPolicies, Pod security settings, image scanning and a secrets manager (for example Sealed Secrets or External Secrets) would be the next hardening steps.
