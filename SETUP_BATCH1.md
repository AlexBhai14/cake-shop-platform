# SETUP AND RUN GUIDE (Batch 1: Infrastructure + MySQL + Prisma + Auth Service)

Is zip ko apne project folder `D:\Sahil_Code\Project\Cake\cake-shop-platform` me extract karo
(files merge ho jayengi, `.git` folder safe rehta hai). Phir VS Code me us folder ko kholo.

## What is included in this batch

| Area | Status |
|---|---|
| MySQL 8.4 in Docker with persistent volume, 8 databases, 8 least-privilege users | Written |
| Redis, RabbitMQ (management UI), Mailpit in Docker Compose | Written |
| Auth Service (NestJS + Prisma): register, login, refresh rotation, logout, /me, RBAC demo route, health endpoints | Written |
| Admin provisioning through a seed script (no public admin signup) | Written |
| Unit tests (AuthService, RolesGuard) | Written |
| Dockerfile (multi-stage) for auth-service | Written |
| Other services, gateway, React apps, Kubernetes, CI/CD, monitoring | NOT in this batch |

IMPORTANT: this code was written without being able to run it (no internet in the build environment),
so nothing here has been executed yet. Run the checks below and send me any error in full.

## Step 1: Create the root .env

```powershell
Copy-Item .env.example .env
```

Open `.env` in VS Code and change every password and the JWT secret. Use letters and digits only in passwords.
`.env` is ignored by Git. Never commit it.

## Step 2: Start the infrastructure

```powershell
docker compose up -d mysql redis rabbitmq mailpit
```

Wait about 60 seconds, then:

```powershell
docker compose ps
```

mysql, redis and rabbitmq should show `healthy`.

Check that the 8 databases exist (replace the password with your MYSQL_ROOT_PASSWORD):

```powershell
docker exec cake-mysql mysql -uroot -pYOUR_ROOT_PASSWORD -e "SHOW DATABASES LIKE 'cake_%';"
```

Dashboards: RabbitMQ http://localhost:15672 (user and password from .env), Mailpit http://localhost:8025

## Step 3: Install and prepare the Auth Service

```powershell
cd backend\auth-service
Copy-Item .env.example .env
```

Edit `backend\auth-service\.env`: use the same AUTH_DB_PASSWORD in both URLs, the same JWT secret, and set ADMIN_EMAIL / ADMIN_PASSWORD.

```powershell
npm install
```

```powershell
npx prisma migrate dev --name init
```

This creates `prisma/migrations/...` (commit that folder to Git) and the tables `users` and `refresh_tokens`.

## Step 4: Run the unit tests

```powershell
npm test
```

Expected: 2 test suites passed (AuthService and RolesGuard).

## Step 5: Create the first admin and start the service

```powershell
npm run seed
```

```powershell
npm run start:dev
```

Open a second PowerShell window for the checks below.

## Step 6: Try the API

Register a customer:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/register -ContentType 'application/json' -Body '{"email":"customer@example.com","password":"Password123"}'
```

Login (save the tokens):

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/login -ContentType 'application/json' -Body '{"email":"customer@example.com","password":"Password123"}'
```

Authenticated request (expect your user details):

```powershell
Invoke-RestMethod -Uri http://localhost:3001/auth/me -Headers @{ Authorization = "Bearer $($login.accessToken)" }
```

Role check: a CUSTOMER on an admin route must get 403:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/auth/admin/ping -Headers @{ Authorization = "Bearer $($login.accessToken)" }
```

No token must get 401:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/auth/me
```

Refresh rotation:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/refresh -ContentType 'application/json' -Body (@{ refreshToken = $login.refreshToken } | ConvertTo-Json)
```

Using the same old refresh token a second time must fail with 401 (reuse detection).

Health: http://localhost:3001/health and http://localhost:3001/health/ready

## Step 7 (optional): Run the Auth Service in Docker instead

```powershell
cd ..\..
docker compose up -d --build auth-service
docker compose logs -f auth-service
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Databases not created | The init script runs only on an EMPTY volume. Reset with `docker compose down -v` (this deletes all MySQL data), then start again. |
| Port 3306 already in use | Stop your local MySQL, or change `127.0.0.1:3306:3306` in docker-compose.yml. |
| `01-init-databases.sh` fails with `\r` errors | The file got Windows line endings. The included `.gitattributes` forces LF; re-extract the zip and run `git add --renormalize .` |
| Prisma cannot connect | Check the password in `backend\auth-service\.env` matches the root `.env`, and mysql shows `healthy`. |
| `migrate dev` says shadow database error | The shadow DB `cake_auth_db_shadow` is created by the init script. If you created the volume before, reset it as above. |
| bcrypt build errors on Windows | Not applicable: this project uses `bcryptjs` (pure JavaScript, same bcrypt algorithm, no native build). |

## Commit this batch

```powershell
git status
git add .env.example .gitattributes SETUP.md docker-compose.yml database infrastructure backend
git status
git commit -m "feat(auth): add mysql infrastructure, prisma schema and auth service"
git log --oneline
git push
```

Check that `git status` does NOT list any `.env` file before committing.
