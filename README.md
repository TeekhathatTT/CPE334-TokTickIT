# TokTickIT

## Local database setup

Before running the backend or Prisma commands, create a local PostgreSQL database and set the required environment variables in `.env` (for example `DATABASE_URL` and `PORT`).

Run the Prisma migration and seed locally with:

```bash
cd server
npx prisma migrate dev --name init
npm run prisma:seed
```

If you are using a different local database name/user/password, update `DATABASE_URL` in `.env` first.
