# Cloud-Native Cake Shop Platform
## Design and Implementation of a Microservices-Based E-Commerce Application with Event-Driven Checkout

**MSc IT Final-Year Project Report**

Student: [your name] | Enrolment no.: [number] | University: [name] | Guide: [name] | Year: [year]

> How to use this draft: it describes what the project contains. Everything in square brackets, and every table in chapter 8,
> must be filled with YOUR real results (test outputs, screenshots, measurements). Do not report a number that you did not measure.

---

## 1. Abstract

Online shops must stay correct when many customers order at the same time, and must keep working when parts of the system fail.
This project designs and implements a cloud-native cake shop as nine independent NestJS microservices behind an API gateway, two React applications (customer and admin),
a MySQL database per service, RabbitMQ for asynchronous communication and Redis for rate limiting. The central problem is the checkout: stock, payment and order live in different databases,
so a distributed transaction is not possible. The project solves it with an orchestrated saga, the transactional outbox pattern, idempotent consumers, retry and dead letter queues and reconciliation of uncertain payment results.
Payments are simulated. The system is packaged with Docker, deployed with Kubernetes, tested on three levels (unit, integration with a real database, end to end), monitored with Prometheus and Grafana, and built and deployed by a GitHub Actions pipeline.

**Keywords:** microservices, saga pattern, transactional outbox, idempotency, RabbitMQ, NestJS, Prisma, Kubernetes, CI/CD.

## 2. Introduction

### 2.1 Background
A monolithic shop application is simple to start with, but one change redeploys everything, one fault can stop everything, and parts cannot scale separately.
Large companies split their systems into small services. This brings new problems: data is spread over many databases, calls between services can fail, and messages can arrive twice or late.

### 2.2 Problem statement
How can a shop guarantee that (a) the last cake is never sold twice, (b) an order is never confirmed without a successful payment and never lost after a successful payment, and (c) the customer is informed,
when the order, stock, payment and notification services run independently and can fail at any moment?

### 2.3 Objectives
1. Design a microservices architecture with clear data ownership.
2. Implement secure authentication and role-based authorization.
3. Implement a reliable, event-driven checkout without distributed database transactions.
4. Build customer and admin web applications connected to real backend APIs.
5. Containerize and deploy the system with Docker and Kubernetes.
6. Automate testing, building and deployment with a CI/CD pipeline.
7. Make the system observable (metrics, logs, health checks).

### 2.4 Scope and exclusions
Included: catalogue, cart, delivery slots, stock, orders, simulated payments and refunds, emails, admin panel, analytics.
Excluded on purpose: real payment processing, real delivery tracking, multi-tenant or multi-shop support, TLS certificates management, password reset and multi-factor authentication.

## 3. Technology and literature review

| Topic | Summary | Source |
|---|---|---|
| Microservices | Independently deployable services organized around business capabilities, each owning its data | Newman, *Building Microservices*, 2nd ed., O'Reilly, 2021 |
| Saga | A long transaction is a sequence of local transactions with compensating actions | Garcia-Molina and Salem, "Sagas", ACM SIGMOD, 1987; Richardson, *Microservices Patterns*, Manning, 2018 |
| Outbox, idempotency, delivery guarantees | Writing events in the same transaction as state changes; at-least-once delivery requires idempotent receivers | Kleppmann, *Designing Data-Intensive Applications*, O'Reilly, 2017; Richardson (2018) |
| JWT | Compact signed tokens | RFC 7519 (IETF, 2015) |
| Authorization framework background | Access and refresh tokens | RFC 6749 (OAuth 2.0), RFC 6819 (threat model) |
| Application security | Ten most critical web application risks | OWASP Top 10, 2021 |
| Containers and orchestration | Pods, Deployments, probes, rolling updates | Kubernetes documentation, kubernetes.io |
| Observability | Metrics, logs and alerts | Prometheus and Grafana documentation |
| NestJS, Prisma, RabbitMQ | Framework, ORM and broker documentation | docs.nestjs.com, prisma.io/docs, rabbitmq.com/docs |

Add 5 to 10 more references that you actually read (papers or articles) and cite them in chapters 5 and 6.

## 4. Requirements

### 4.1 Functional requirements
Customers: register and log in; browse, search and filter cakes; choose flavour, size, eggless or regular and a message; keep a cart; choose an address, a delivery date and a time slot; pay (simulated); see order tracking and history; manage profile and addresses.
Administrators: manage categories, cakes, variants and prices; manage stock and delivery-slot capacity; move orders through the production stages and cancel them; manage customer accounts; see payments, emails and analytics.

### 4.2 Non-functional requirements
| Area | Requirement |
|---|---|
| Correctness | No overselling; no double charge; consistent order status |
| Security | Hashed passwords, backend authorization, rate limiting, secrets outside Git |
| Reliability | Survive restarts and duplicate or delayed messages |
| Scalability | Stateless services, horizontal scaling in Kubernetes |
| Maintainability | Independent services, tests, documentation, CI |
| Observability | Health checks, metrics, correlation ids |
| Portability | Runs with Docker Compose and on Kubernetes |

## 5. System design
Full detail: `docs/architecture/ARCHITECTURE.md`. Summary:

- **Architecture style:** API gateway + nine services; REST for queries, RabbitMQ topic exchange for events.
- **Data design:** MySQL, one database and one least-privilege user per service, UUID keys, DECIMAL money, UTC timestamps; no cross-service foreign keys. (`database/documentation/DATABASE.md`)
- **Order state machine:** nine statuses with an explicit transition table; invalid changes return HTTP 409.
- **Checkout saga:** orchestrated by the order service (sequence diagram in ARCHITECTURE.md, section 4).
- **Security design:** bcrypt, JWT (15 minutes), rotating opaque refresh tokens with reuse detection, RBAC in every service, Redis rate limiting in the gateway, validation, Helmet.
- **Event contracts:** twelve versioned event types (`docs/api-documentation/EVENTS.md`).

[Insert figures: architecture diagram, saga sequence diagram, entity-relationship diagrams of the databases.]

## 6. Implementation

### 6.1 Methodology
The system was built in phases: environment, databases, auth, products, cart, inventory, order saga, payments, messaging, rate limiting, front ends, containers, Kubernetes, CI/CD, monitoring. Each phase was documented and committed to Git.
Work was done in batches and every batch had its own tests and a step-by-step verification guide (`SETUP_BATCH*.md`).

### 6.2 Selected solutions

**Authentication.** Passwords are hashed with bcrypt (library `bcryptjs`, the same algorithm without native compilation). The access token contains the user id, email and role. A refresh token is a random 96-character value;
only its SHA-256 hash is stored. Each refresh revokes the old token and issues a new pair. If a revoked token is presented again, all tokens of that user are revoked (theft detection).

**No overselling.** A reservation runs inside one transaction: `UPDATE inventory_items SET reserved = reserved + :qty WHERE variantId = :id AND onHand - reserved >= :qty`.
The database locks the row, so concurrent requests are serialized and the loser updates zero rows. The same technique protects delivery-slot capacity. Made-to-order cakes have no stock row and are limited by slot capacity only.

**Transactional outbox.** The order service writes the order and the `OrderCreated` event into one transaction. A publisher polls unpublished rows, sends them with publisher confirms and marks them published. A crash can duplicate a message but never lose one.

**Idempotent consumers.** Each service stores the ids of processed events in the same transaction as the work. A duplicate delivery finds the id and does nothing. Business operations are idempotent as well (one reservation per order, one payment per order, `Idempotency-Key` on checkout).

**Retries and dead letters.** A failing handler sends the message to `<queue>.retry` (TTL 5 seconds, then it returns to the main queue). After three attempts it goes to `<queue>.dlq`, which Prometheus watches.

**Uncertain payments.** A simulated timeout leaves the payment `UNKNOWN`. A reconciliation job asks the mock bank again. The order service cancels orders that stay unpaid for 15 minutes. A payment that succeeds after cancellation triggers a refund request.

**Front ends.** React with TypeScript and Tailwind. An Axios interceptor adds the token and, on HTTP 401, refreshes it once (concurrent requests share one refresh because tokens rotate). Pages that depend on background events poll the API until the order reaches a final status.

**Observability.** Every service exposes `/metrics` (request count and latency by route pattern, process metrics, outbox backlog). A correlation id is created by the gateway and carried through events.

### 6.3 Code organization
Each service has `src`, `prisma`, tests, a multi-stage Dockerfile and its own `package.json`. Shared code is avoided on purpose; the messaging code is intentionally identical in four services.

## 7. Testing

### 7.1 Strategy
| Level | Tool | Purpose |
|---|---|---|
| Unit | Jest, Vitest | Business rules with fakes |
| Integration | Jest + Testcontainers (MySQL 8.4) | Real SQL, concurrency, rollback |
| End to end | Jest + Supertest | Whole system through the gateway: security, saga, payments, emails |
| Load | k6 | Latency and error rate under load |
| Security | E2E authorization tests, manual checks | See `docs/SECURITY_REVIEW.md` |

### 7.2 Notable test cases
- 20 concurrent customers order 5 cakes: exactly 5 succeed.
- Reusing a rotated refresh token is refused and revokes the session.
- A customer cannot read, pay or cancel another customer's order (403).
- The same checkout key returns the same order.
- A failed payment releases stock and slot; a cancelled paid order is refunded once.
- A bank timeout is resolved by reconciliation and the order becomes confirmed.
- Emails arrive in the test inbox.

## 8. Results and evaluation (fill with your own measurements)

### 8.1 Test results
| Test level | Command | Suites | Tests | Result | Date |
|---|---|---|---|---|---|
| Unit, backend | `npm test` per service | [ ] | [ ] | [ ] | [ ] |
| Unit, frontend | `npm test` per app | [ ] | [ ] | [ ] | [ ] |
| Integration | `npm run test:int` | [ ] | [ ] | [ ] | [ ] |
| End to end | `npm test` in `tests/e2e` | [ ] | [ ] | [ ] | [ ] |
| Rate limit | `npm run test:ratelimit` | [ ] | [ ] | [ ] | [ ] |
[Add a screenshot of each result and of the GitHub Actions run.]

### 8.2 Code coverage
[Table of statement coverage per service from `npm test -- --coverage`.]

### 8.3 Load test
Tool k6, script `tests/performance/load-test.js`, [number] virtual users for [duration] on [your hardware].
| Metric | Result | Target |
|---|---|---|
| Requests per second | [ ] | |
| p95 response time | [ ] ms | below 500 ms |
| Error rate | [ ] % | below 1 % |
[Add Grafana screenshots taken during the test.]

### 8.4 Resilience experiments
| Experiment | Expected | Observed |
|---|---|---|
| Stop RabbitMQ during checkout, start it again | The order continues; `outbox_pending_events` grows and returns to 0 | [ ] |
| Delete the order service pod in Kubernetes | A new pod starts; no order is lost | [ ] |
| Deploy a broken image | The old pods keep serving; rollback restores | [ ] |
| Stop the mail server | Emails are saved as pending and sent later | [ ] |
| Stop MySQL | Pods become not ready, are not restarted | [ ] |

### 8.5 Discussion
Discuss what worked, what was hard (for example the order of events, idempotency details, local Kubernetes image loading), and compare with a monolithic design in terms of complexity versus independence.

## 9. Deployment and DevOps
Docker Compose for development; Kubernetes with Kustomize (`infrastructure/kubernetes`); GitHub Actions pipeline: lint, tests, image build, Docker Hub, approved deployment, smoke test, automatic rollback (`docs/ci-cd/CI_CD.md`).
Secrets are created in the cluster from a local file and never stored in Git.
[Add screenshots: pipeline run, `kubectl get pods`, Grafana dashboard.]

## 10. Limitations and future work
Limitations are listed in `docs/SECURITY_REVIEW.md` (access tokens cannot be revoked immediately, refresh token in localStorage, no TLS locally, shared symmetric JWT secret, no password reset or MFA) and:
the messaging code is duplicated in four services; the saga is orchestrated by one service; Mailpit instead of a real mail provider; no real delivery partner integration; analytics are computed on demand.
Future work: a real payment provider through a hosted checkout page, RS256 tokens, an API for service-to-service authentication, an event schema registry, CQRS read models for analytics, a service mesh, blue-green releases.

## 11. Conclusion
The project shows that a reliable checkout is possible across independent services when each step is a local transaction, events are written with the outbox pattern, consumers are idempotent and uncertain outcomes are reconciled.
The result is a complete system that can be built, tested, deployed and observed with standard industry tools.

## 12. Viva preparation: questions and short answers

1. **Why microservices for a small shop?** To learn and demonstrate independent deployment, data ownership and distributed reliability. A real small shop could start as a monolith.
2. **Why not one database transaction across services?** Services own separate databases. Two-phase commit is slow, couples availability and is rarely supported. A saga uses local transactions and compensation.
3. **What is the transactional outbox?** The event is saved in the same transaction as the data change and published later, so a crash cannot lose it.
4. **Does RabbitMQ guarantee exactly once?** No, at least once. That is why consumers are idempotent.
5. **How do you prevent overselling?** A conditional UPDATE under a row lock inside a transaction; proved with a real MySQL in the integration test.
6. **How do you handle a payment timeout?** Status UNKNOWN, reconciliation asks the bank again, timeout cancellation, and refund if it succeeds late.
7. **Access vs refresh token?** The access token is short and sent with each request; the refresh token is long-lived, stored hashed, rotated on each use.
8. **What is refresh-token reuse detection?** A revoked token used again indicates theft: all sessions of the user are revoked.
9. **Authentication vs authorization?** Who you are versus what you may do. Both are enforced in the backend.
10. **Why is frontend route protection not enough?** The API can be called directly; only the backend can enforce access.
11. **How does rate limiting work across several gateway instances?** The counter is in Redis (atomic INCR with expiry), shared by all instances.
12. **Fixed window vs sliding window vs token bucket?** Fixed is simple but allows bursts at window edges; sliding is smoother and costs more; token bucket allows controlled bursts.
13. **Pod vs container?** A container is one process image; a Pod wraps one or more containers with shared network and storage and is the unit Kubernetes schedules.
14. **Readiness vs liveness probe?** Readiness decides whether traffic is sent; liveness decides whether the container is restarted.
15. **How does a rolling update avoid downtime?** `maxUnavailable: 0`: new pods become ready before old ones stop.
16. **Why store money as DECIMAL?** Floating point cannot represent decimal fractions exactly.
17. **Why a database per service?** Independent change and scaling; the price is that joins must be done in code.
18. **How is a duplicate checkout prevented?** The `Idempotency-Key` header with a unique constraint.
19. **How do you test asynchronous behaviour?** Poll for the result with a timeout instead of sleeping a fixed time.
20. **What would you change for production?** TLS, managed database, asymmetric JWT, httpOnly cookies, real mail and payment providers, secret manager, network policies, Alertmanager.

## References
[List the references from chapter 3 in your university's citation style (IEEE or APA).]

## Appendix A: Repository layout and how to run
See `README.md` and `RUN_ME_FIRST.md`.

## Appendix B: API and event reference
See `docs/api-documentation/API.md` and `docs/api-documentation/EVENTS.md`.

## Appendix C: Screenshots
[Customer shop, cart, checkout, payment page, order tracking, admin dashboard, orders, inventory, Grafana, Prometheus alerts, pipeline run.]
