# Admin Endpoints used by the Admin App (all need an ADMIN token)

| Method and path (via gateway) | Service | Purpose |
|---|---|---|
| GET /api/orders/admin/stats?days=14 | order | Dashboard and analytics numbers (new in Batch 7) |
| GET /api/orders/admin/all?status=&page=&limit= | order | Order list |
| PATCH /api/orders/:id/status | order | Move an order along the state machine |
| POST /api/orders/:id/cancel | order | Admin cancel (until ACCEPTED) |
| GET /api/auth/admin/users?page=&limit= | auth | Account list (new in Batch 7) |
| PATCH /api/auth/admin/users/:id/status | auth | Suspend or re-activate an account (new in Batch 7) |
| GET /api/users?page=&limit= | user | Customer profiles |
| GET /api/categories/admin/all, POST /api/categories, PATCH /api/categories/:id | product | Category management |
| GET /api/cakes/admin/all, POST /api/cakes, PATCH /api/cakes/:id | product | Cake management |
| POST /api/cakes/:id/variants, PATCH /api/variants/:id | product | Variants and prices |
| GET /api/inventory/items, PUT /api/inventory/items/:variantId | inventory | Stock list and stock level |
| POST /api/inventory/items/:variantId/adjustments, GET .../history | inventory | Adjustments and history |
| GET /api/inventory/slots?date=, PUT /api/inventory/slots | inventory | Delivery slot capacity |
| GET /api/payments/admin/all, POST /api/payments/orders/:orderId/refund | payment | Payments and mock refunds |
| GET /api/notifications/admin/all | notification | Email log |
