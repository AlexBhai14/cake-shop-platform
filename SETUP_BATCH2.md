# SETUP GUIDE: Batch 2 (Product Service and User Service)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge). Two existing files are replaced:
`docker-compose.yml` (two new services added, nothing removed) and `database/documentation/DATABASE.md`.

Ports: auth 3001, user 3002, product 3003. The MySQL databases and users for both already exist from Batch 1.

IMPORTANT: written but not executed by me (no internet in my build environment). Send me any error in full.

## A. Product Service

```powershell
cd backend\product-service
Copy-Item .env.example .env
```

Edit `.env`: put the real PRODUCT_DB_PASSWORD (the one from the root `.env`) in both URLs, and the same JWT secret as auth-service.

```powershell
npm install
npx prisma migrate dev --name init
npm test
npm run seed
npm run start:dev
```

Expected: 2 suites pass (cakes.service and roles.guard). Seed prints `Product seed complete`.

Try it (new PowerShell window):

```powershell
Invoke-RestMethod http://localhost:3003/categories
Invoke-RestMethod "http://localhost:3003/cakes?eggless=true&maxPrice=800"
Invoke-RestMethod "http://localhost:3003/cakes?search=velvet"
```

Customer must not create a cake (expect 403). Use the customer token from Batch 1 (`$login` in the same window, or login again):

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/login -ContentType 'application/json' -Body '{"email":"customer@example.com","password":"Password123"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3003/categories -Headers @{ Authorization = "Bearer $($login.accessToken)" } -ContentType 'application/json' -Body '{"name":"Test"}'
```

Admin can create a category (login with the ADMIN_EMAIL / ADMIN_PASSWORD from auth-service `.env`):

```powershell
$admin = Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/login -ContentType 'application/json' -Body '{"email":"admin@cakeshop.local","password":"ChangeMeAdmin123"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3003/categories -Headers @{ Authorization = "Bearer $($admin.accessToken)" } -ContentType 'application/json' -Body '{"name":"Anniversary Cakes"}'
```

## B. User Service

```powershell
cd ..\user-service
Copy-Item .env.example .env
```

Edit `.env` the same way (USER_DB_PASSWORD).

```powershell
npm install
npx prisma migrate dev --name init
npm test
npm run start:dev
```

Expected: 2 suites pass (users.service and roles.guard).

Try it:

```powershell
Invoke-RestMethod http://localhost:3002/users/me -Headers @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Method Post http://localhost:3002/users/me/addresses -Headers @{ Authorization = "Bearer $($login.accessToken)" } -ContentType 'application/json' -Body '{"label":"Home","line1":"12 MG Road","city":"Mumbai","state":"Maharashtra","postalCode":"400001"}'
Invoke-RestMethod http://localhost:3002/users -Headers @{ Authorization = "Bearer $($login.accessToken)" }
```

The last call must return 403 for a customer and work with `$admin.accessToken`.

## C. Run everything in Docker (optional)

```powershell
cd ..\..
docker compose up -d --build user-service product-service
docker compose ps
```

## Commit

Commit the new `prisma/migrations` folders too (they are part of the project).

```powershell
git status
git add docker-compose.yml database backend SETUP_BATCH2.md
git status
git commit -m "feat(catalog): add product and user services with prisma schemas"
git log --oneline
git push
```

Make sure `git status` shows no `.env` file before you commit.
