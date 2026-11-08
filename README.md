# Cloud-Native Cake Shop Platform

A microservices-based e-commerce platform for an online cake shop, built as an MSc IT final-year project.

Customers can browse and customize cakes, choose a delivery date and time slot, pay through a **mock payment gateway**, and track their orders. Administrators manage cakes, inventory, orders and delivery slots.

> **Note:** Payments are fully simulated. No real money is processed.

## Status

Under development. Phase 01 (Environment Verification and Project Setup) is complete once its commit is verified. See `git-management/` for per-phase records.

## Planned Architecture

| Service | Responsibility |
|---|---|
| API Gateway | Single entry point, routing, token validation, rate limiting |
| Auth Service | Registration, login, JWT, refresh tokens, roles |
| User Service | Profiles and delivery addresses |
| Product Service | Cakes, categories, search and filtering |
| Cart Service | Cart management and price validation |
| Inventory Service | Stock, reservations, production capacity |
| Order Service | Checkout, order lifecycle, tracking |
| Payment Service | Mock payments and refunds |
| Notification Service | Email notifications |

Each service owns its own MySQL database. Services communicate through REST APIs and RabbitMQ events.

## Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS, React Router
- **Backend:** Node.js, TypeScript, NestJS
- **Database:** MySQL, Prisma ORM
- **Security:** Passport.js, JWT, bcrypt, RBAC
- **Messaging and cache:** RabbitMQ, Redis
- **Testing:** Jest, Supertest, Testcontainers
- **DevOps:** Docker, Docker Compose, Kubernetes, GitHub Actions
- **Monitoring:** Prometheus, Grafana

## Project Structure

```
cake-shop-platform/
|-- frontend/          React customer and admin apps
|-- backend/           NestJS microservices
|-- database/          MySQL setup, seed data, documentation
|-- infrastructure/    Docker, Kubernetes, RabbitMQ, Redis, monitoring
|-- git-management/    Git workflow and per-phase Git records
|-- docs/              Architecture, API docs, learning notes, report
|-- scripts/           Helper scripts
|-- .github/workflows/ CI/CD pipelines
```

Service folders inside `frontend/` and `backend/` are created progressively as each phase begins.

## Security

Never commit `.env` files, passwords or private keys. Use `.env.example` with dummy values only.
