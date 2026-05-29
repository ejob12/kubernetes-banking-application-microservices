# LionTech Finance

LionTech Finance is a full microservices digital banking application built for LionTech DevOps Students. It includes a customer banking frontend, admin dashboard, API gateway, authentication, profile management, account creation, balance/portfolio balancer, notifications, deposits, e-transfer, international transfer, analytics, and AI assistant services.

## Services

| Component | Purpose |
| --- | --- |
| `frontend` | Bank-style web UI with login, registration, profile, accounts, deposits, transfers, AI, and admin views |
| `api-gateway` | Single public API entrypoint routing `/api/*` to internal services |
| `auth-service` | User registration, login, signed tokens, demo customer/admin accounts |
| `profile-service` | Customer profile and KYC status data |
| `accounts-service` | Saving, current, and investment accounts with balances and ledger entries |
| `balancer-service` | Balance summaries, portfolio mix, liquidity score, FX rates |
| `notifications-service` | In-app banking notifications |
| `deposits-service` | Deposit workflow and account crediting |
| `transfers-service` | E-transfer and international transfer workflow |
| `analytics-service` | Customer and platform analytics |
| `ai-service` | Deterministic banking assistant, insights, and risk scoring |
| `admin-service` | Admin dashboard, customer overview, risk review actions |

## Demo Access

Customer:

```text
demo@liontech.finance
Liontech@123
```

Admin:

```text
admin@liontech.finance
Admin@123
```

## Run Locally With Docker Compose

```powershell
cd "C:\Users\Immigration\Documents\New project\liontech-finance"
copy .env.example .env
docker compose up --build
```

Open:

```text
http://localhost:8090
```

API gateway:

```text
http://localhost:8091/health
```

## Smoke Test Without Docker

The Node services use only built-in Node.js modules, so the full backend can be smoke-tested without installing packages.

```powershell
cd "C:\Users\Immigration\Documents\New project\liontech-finance"
node scripts/smoke-test.js
```

## Run The Local Dev Server Without Docker

```powershell
cd "C:\Users\Immigration\Documents\New project\liontech-finance"
node scripts/dev-server.js
```

Open:

```text
http://localhost:45000
```

## Build, Tag, And Push Images

Log in to Docker Hub first:

```powershell
docker login
```

PowerShell:

```powershell
cd "C:\Users\Immigration\Documents\New project\liontech-finance"
.\scripts\build-tag-push.ps1 -Namespace your-dockerhub-username -Tag 1.0.0
```

Bash:

```bash
cd liontech-finance
DOCKERHUB_NAMESPACE=your-dockerhub-username IMAGE_TAG=1.0.0 ./scripts/build-tag-push.sh
```

The Kubernetes manifest currently references:

```text
docker.io/liontechdevopsstudents/liontech-finance-*:1.0.0
```

Replace `liontechdevopsstudents` with your Docker Hub namespace if needed.

## Deploy To Kubernetes

```powershell
kubectl apply -f k8s/liontech-finance.yaml
kubectl get svc -n liontech-finance
```

The manifest exposes both the frontend and API gateway with `type: LoadBalancer`.

## Jenkins CI/CD

The project includes a complete Jenkins pipeline at `Jenkinsfile`. Configure these Jenkins credentials before running it:

| Credential ID | Type | Purpose |
| --- | --- | --- |
| `dockerhub-credentials` | Username with password | Docker Hub username and access token/password |
| `kubeconfig-liontech-finance` | Secret file | Kubeconfig for the target Kubernetes cluster |
| `liontech-finance-auth-secret` | Secret text | JWT signing secret for the auth service |
| `liontech-finance-service-token` | Secret text | Internal service-to-service token |

The pipeline validates Node service syntax, builds all component images, tags each image with `BUILD_NUMBER-GIT_SHA`, pushes that tag plus `latest` to Docker Hub, applies the Kubernetes manifest, updates deployments to the new image tag, and waits for rollout completion.

## Notes For Production Hardening

This project is structured like a real bank platform, but the bundled runtime storage is intentionally simple for DevOps training. Production deployment should add managed databases, external secrets, TLS certificates, audit logging, formal KYC/AML integrations, payment rail integrations, rate limiting, WAF controls, and disaster recovery.

© 2026 LionTech Finance. Built by LionTech DevOps Students.
