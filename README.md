# wenzong-api

Node.js + Express + TypeScript + Prisma + PostgreSQL backend for Wenzong.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your local `DATABASE_URL`, `JWT_SECRET`, and optional `FRONTEND_ORIGIN`.

3. Create the PostgreSQL database referenced by `DATABASE_URL`.

4. Run database migrations:

   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

## Production

Build and start the compiled server:

```bash
npm run build
npm run start
```

Run production migrations with:

```bash
npm run prisma:migrate
```

## Health Check

```http
GET /health
```

Returns a JSON response when the API is running.

## Question Bank API

Public endpoints:

```http
GET /api/questions
GET /api/questions/:id
GET /api/subjects
```

Admin endpoints require a JWT for a user with `role=admin`:

```http
POST /api/admin/questions
PUT /api/admin/questions/:id
DELETE /api/admin/questions/:id
```

Seed example question data:

```bash
npm run seed:questions
```
