# TokTickIT

Local setup instructions for frontend (Vite + React + TypeScript) and backend (Express + TypeScript + Prisma).

Prerequisites:
- Node.js 18+ and a package manager (npm/pnpm/yarn)
- PostgreSQL running locally

Quick start (root of repo):

1. Copy the client environment example and edit the API URL:

```
cd client
cp .env.example .env
```

2. Install dependencies for both packages:

```
cd client
npm install
cd ../server
npm install
```

Run frontend:

```
cd client
npm run dev
```

Run backend (dev):

```
cd server
npm run dev
```

Run tests (both):

```
cd client
npm test
cd ../server
npm test
```

Run browser E2E and responsive checks (requires Docker Desktop/PostgreSQL and seeded data):

```
docker compose up -d db
cd server
npm run prisma:migrate
npm run prisma:seed
cd ../client
npm run test:e2e
```

Lab 2-4 E2E (`client/e2e/`) reset and reseed the disposable local database via
Playwright `globalSetup` (`prisma migrate reset --force --skip-seed` + seed) so
runs are hermetic (set `E2E_SEED=0` to skip with hand-managed data). They
require the client origin `http://localhost:5173` to match the API CORS/CSRF
contract (`CLIENT_URL`, see `client/playwright.config.ts`).

Run the full browser suite (35 tests: Lab 2/3 regression + Lab 4):

```
cd client
npx playwright test --workers=1
```

Lab 4 dashboard parity/performance check (requires seeded data):

```
cd server
npm run verify:dashboards
```

Lab 4 visual evidence is captured by the E2E run under
`artifacts/lab-04/screenshots/`.

Notes:
- Do not commit `.env` or `node_modules`. The client uses `VITE_API_URL` from `client/.env.example`.
- Compiled/transpiled files in `client/src` should not be committed; keep source files (`.tsx`, `.ts`).# TokTickIT 
- Lab 2 unit, API, and UI tests run with the two `npm test` commands above. Playwright E2E and responsive tests are configured under `client/e2e` and require the database/application environment.
