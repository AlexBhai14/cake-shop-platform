
# SETUP GUIDE: Batch 9 (CI/CD, lint, documentation, report)

Extract this zip into `D:\Sahil_Code\Project\Cake\cake-shop-platform` (merge, replace when asked).
Replaced files: `README.md`, `.gitignore`, the gateway `main.ts` and `package.json` (Helmet security headers), the `nginx.conf` of both React apps (security headers), `tests/e2e/src/authorization.e2e.spec.ts`.
New: root `package.json` and `eslint.config.mjs`, `.github/workflows/ci-cd.yml` and `e2e.yml`, `.github/dependabot.yml`, `docker-compose.ci.yml`, `scripts/*.sh|*.ps1`, `RUN_ME_FIRST.md`,
`docs/architecture`, `docs/api-documentation/API.md`, `docs/ci-cd`, `docs/SECURITY_REVIEW.md`, `docs/project-report`, `tests/performance`.

IMPORTANT: written but not executed by me. Send me any error in full, especially from the first pipeline run on GitHub.

## 1. Gateway security headers

```powershell
cd backend\api-gateway
npm install
npm test
```

Expected: 7 suites pass. Restart the gateway, then check:

```powershell
curl.exe -I http://localhost:3000/api/cakes
```

You should see `X-Content-Type-Options: nosniff` and NO `X-Powered-By` line.

## 2. Lint at the project root

```powershell
cd ..\..
npm install
npm run lint
```

Expected: no errors (warnings about unused variables are allowed). If ESLint reports errors, copy the output: the rules are easy to adjust.

## 3. Commit the files the pipeline needs

The pipeline uses `npm ci` and checks that migrations exist. Make sure these are in Git:

```powershell
git status
git add package.json package-lock.json eslint.config.mjs .github scripts docker-compose.ci.yml
git add backend frontend tests docs README.md RUN_ME_FIRST.md SETUP_BATCH*.md
git status
```

Check that `package-lock.json` files of every service and app and every `prisma\migrations` folder are listed as new files, and that NO `.env` is listed.

```powershell
git commit -m "ci: add github actions pipeline, lint, security headers and final documentation"
git push
```

## 4. Prepare GitHub (once)

Follow `docs/ci-cd/CI_CD.md`, section "One-time setup":
1. Docker Hub access token.
2. Repository secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (and `KUBE_CONFIG` for a remote cluster).
3. Environment `production` with you as required reviewer.
4. For the Docker Desktop cluster on your PC: a self-hosted runner and the variable `DEPLOY_RUNNER = self-hosted`, plus the cluster Secret (`scripts\create-k8s-secret.ps1`) and the namespace.

## 5. Watch the pipeline

Open the repository on GitHub > Actions > "CI/CD".
- A push to a `phase/...` or `feature/...` branch and every pull request run: Lint, Secrets scan, Backend (9 jobs), Frontend (2), Integration.
- A push to `main` additionally runs Publish (11 images to Docker Hub), then Deploy waits for your approval (yellow "Waiting"). Click Review deployments > Approve.
- After approval: apply, rollout, smoke test. A failing smoke test rolls the deployment back automatically.

The first run will probably show a few failures (unseen mistakes in code that was never run, or a missing lock file or migration). Send me the log of the failing job and we fix it.

Try the safety nets once:
1. Make a unit test fail on purpose in a branch and open a pull request: the pipeline turns red and nothing is published.
2. After a successful deployment, check the image tags: `kubectl get deployment api-gateway -n cake-shop -o jsonpath="{.spec.template.spec.containers[0].image}"` shows `<user>/cake-api-gateway:<commit sha>`.

## 6. Nightly end-to-end run

Actions > "E2E" > Run workflow. It builds the whole system on a GitHub runner (15 to 25 minutes) and runs the end-to-end suite. If it fails, download the `compose-logs` artifact.

## 7. Load test (for the report)

Raise the gateway limits (see the comment at the top of `tests\performance\load-test.js`), restart the gateway, keep Grafana open, then:

```powershell
Get-Content tests\performance\load-test.js | docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 grafana/k6 run -
```

Write the numbers (requests per second, p95, error rate) into chapter 8.3 of the report and take a Grafana screenshot. Restore the default limits afterwards.

## 8. The report

Open `docs/project-report/MSC_PROJECT_REPORT.md`. Fill every square bracket and every table in chapter 8 with YOUR results and screenshots, add real references to chapter 3, and read the 20 viva questions in chapter 12.
Convert to Word when you are done: install Pandoc and run `pandoc docs\project-report\MSC_PROJECT_REPORT.md -o MSC_PROJECT_REPORT.docx`, or paste the text into Word.
