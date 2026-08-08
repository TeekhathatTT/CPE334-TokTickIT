# TokTickIT

Local setup instructions for frontend (Vite + React + TypeScript) and backend (Express + TypeScript + Prisma).

Prerequisites:
- Node.js 18+ and a package manager (npm/pnpm/yarn)
- PostgreSQL running locally

Quick start (root of repo):

1. Copy environment example and edit values:

```
cp .env.example .env
```

2. Install dependencies for both packages (from repo root):

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

Notes:
- Do not commit `.env` or `node_modules`. Use `.env.example` for sharing env vars.
- Compiled/transpiled files in `client/src` should not be committed; keep source files (`.tsx`, `.ts`).# TokTickIT 