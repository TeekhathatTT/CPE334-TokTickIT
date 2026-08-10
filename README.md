# TokTickIT

## Run with Docker

1. From the project root, run:
   ```bash
   docker compose up --build
   ```
2. The API will be available at http://localhost:3000
3. The PostgreSQL database will be available at localhost:5432

## Environment

The server uses the DATABASE_URL from [server/.env](server/.env) or [server/.env.example](server/.env.example).
For Docker Compose, the default connection string points to the `db` service name.
