# Monitoring: Prometheus and Grafana

**What:** Prometheus asks every service for its numbers (`GET /metrics`) every 15 seconds and stores them as time series. Grafana draws them. Alert rules say when the numbers look wrong.

**Why:** Logs tell you WHAT happened to one request. Metrics tell you HOW the whole system is doing right now, and let you see a problem before customers complain.

## What every service exposes (`/metrics`)
- `http_requests_total{method,route,status}`: counter. The label `route` is the pattern (`/orders/:id`), never the real URL, so the number of label values stays small.
- `http_request_duration_seconds`: histogram. The p95 latency is computed with `histogram_quantile`.
- Default Node.js metrics: CPU, memory, event loop lag, garbage collection.
- `outbox_pending_events` (inventory, order, payment): events saved in the outbox but not yet in RabbitMQ. It should stay near 0. If it keeps growing, the saga is stuck.
- `notifications_pending`, `notifications_failed` (notification service).
- RabbitMQ: the built-in `rabbitmq_prometheus` plugin (port 15692). The job `rabbitmq-detailed` gives messages per queue, which is how dead letter queues are watched.

## Dashboard "Cake Shop Overview"
Services up, orders per minute, outbox backlog, dead letter messages, request rate, 5xx errors, p95 latency, queue sizes, memory, event loop lag.

## Alerts (visible at http://localhost:9090/alerts)
ServiceDown, HighErrorRate (>5% 5xx), SlowRequests (p95 > 1 s), OutboxBacklog (>50), DeadLetterQueueNotEmpty, EmailsFailing.
A real system adds an Alertmanager that sends these to email, Slack or a pager.

## Security
`/metrics` shows internal details. It is not routed by the gateway or the ingress; only Prometheus inside the network may read it.

## Structured logging
All services write one JSON object per line (level, service, message, correlation id). The correlation id created by the gateway (header `X-Correlation-Id`) is passed on in every event, so one customer action can be followed through all logs.
