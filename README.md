# RintisAI Platform

RintisAI is a multi-model AI chat and developer API platform for Indonesian users. It supports web chat subscriptions, OpenAI-compatible API keys, Anthropic-compatible Claude routes, admin operations, payment upgrades, usage quotas, and package entitlements.

## Prerequisites

- **Node.js** 20 LTS (via nvm)
- **PostgreSQL** 17+ (database managed via Prisma Migrate)

## Development Setup

```bash
git clone <repo-url>
cd rintisai-platform
nvm use 20

# Install dependencies
npm install

# Set up environment
cp .env.example .env   # edit DATABASE_URL and secrets

# Create PostgreSQL database (one-time)
su - postgres -c "psql" <<EOF
CREATE USER rintisai_user WITH PASSWORD '<your-password>';
CREATE DATABASE rintisai OWNER rintisai_user;
GRANT ALL PRIVILEGES ON DATABASE rintisai TO rintisai_user;
\c rintisai
GRANT ALL ON SCHEMA public TO rintisai_user;
EOF

# Run Prisma migrations
npx prisma migrate deploy

# Seed demo/admin users
npm run seed

# Start dev server
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev          # start dev server on 0.0.0.0:3000
npm run build        # production build
npm run seed         # seed demo (test@example.com) and admin (admin@rintisai.com) users
npm run test:e2e     # Playwright E2E tests
npm run lint         # lint check
npx prisma generate  # regenerate Prisma client
npx prisma migrate dev --name <name>  # create new migration
npx prisma migrate deploy             # apply pending migrations
npx prisma studio                     # Prisma GUI (optional)
```

## Main Areas

- Web chat and subscription UX: `src/app/page.js`
- Admin dashboard: `src/app/admin/`
- Public API docs: `src/app/docs/api/page.js`
- OpenAI-compatible API: `src/app/api/v1/chat/completions/route.js`
- Anthropic-compatible API: `src/app/api/v1/messages/route.js`
- Plans and quotas: `src/lib/plans.js`, `src/lib/quota.js`, `src/lib/entitlements.js`
- Model configuration: `src/lib/models.js`

## Database

The project uses **PostgreSQL** with Prisma 7 and the driver adapter pattern.

### Schema

- All models are defined in `prisma/schema.prisma` and managed via Prisma Migrate
- Runtime DDL (table creation, ALTER TABLE) has been eliminated — all schema changes go through migrations

### Adapter

The app uses a dynamic adapter that auto-selects between PostgreSQL (`@prisma/adapter-pg`) and SQLite (`@prisma/adapter-better-sqlite3`) based on the `DATABASE_URL` scheme. This allows running with SQLite for testing while using PostgreSQL in production.

### Migrations

When pulling new migrations from git:

```bash
npx prisma migrate deploy
npm run seed
```

When making schema changes:

```bash
# Edit prisma/schema.prisma, then:
npx prisma migrate dev --name <descriptive_name>
npm run seed
```

### Raw SQL Queries

All parameterized raw queries use Prisma's tagged template syntax (`$queryRaw` / `$executeRaw`), not `?` placeholders. This is required for PostgreSQL compatibility.

```js
// Correct:
await prisma.$queryRaw`SELECT * FROM "User" WHERE "email" = ${email}`

// Wrong (will fail on PostgreSQL):
await prisma.$queryRawUnsafe('SELECT * FROM "User" WHERE "email" = ?', email)
```

## Deployment

Production is self-hosted. Build the app, restart the Node/PM2 process, and keep runtime secrets in environment variables. Do not commit `.env` files or local database files.

### Environment Variables

Key variables (see `.env` for full list):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `RESELLER_API_KEY` | AI model provider API key |
| `RESEND_API_KEY` | Email service API key |
| `NEXT_PUBLIC_URL` | Public base URL |
| `ADMIN_2FA_CODE` | Static 2FA code for admin login |
| `SEED_ADMIN_EMAIL` | Admin email for seed |
| `SEED_ADMIN_PASSWORD` | Admin password for seed |
