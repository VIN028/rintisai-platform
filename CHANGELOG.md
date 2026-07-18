2026-07-17 v1

- Create `dev` branch from `main` for daily development
- Add development standards to `AGENTS.md` (branch strategy, commit conventions, code conventions)
- Set up Node.js 20 via nvm, install dependencies, and generate Prisma client

2026-07-17 v2

- Update `next.config.mjs`:
  - Add `'unsafe-eval'` to CSP `script-src` (React dev mode compatibility)
  - Add `ws://localhost:3000 wss://*.echo.my.id` to CSP `connect-src` (HMR WebSocket)
  - Add `allowedDevOrigins: ['*.echo.my.id']` (dev server behind Cloudflare Tunnel)
- Update `package.json` dev script to `next dev -H 0.0.0.0` (bind all interfaces)

2026-07-17 v3

- Rewrite `AGENTS.md` with latest RintisAI development standards (Changelog, English-only, plain text format)
- Add Changelog Convention: YYYY-MM-DD v1/v2/v3 format
- Add Other Convention: always update .md docs on every commit

2026-07-17 v4

- Replace all Em Dash (—) with regular hyphen (-) across codebase
- Add Em Dash rule to AGENTS.md standards
- Fix prisma/seed.js to load dotenv/config; add SEED_ADMIN_EMAIL/PASSWORD to .env
- Add Schema & Migration section to AGENTS.md

2026-07-18 v5

- Migrate database from SQLite to PostgreSQL 17
  - Create database (rintisai) and user (rintisai_user) with random password
  - Configure pg_hba.conf for local TCP connections (scram-sha-256)
  - Install @prisma/adapter-pg + pg packages
  - Refactor db.js and seed.js for dynamic adapter selection (supports both SQLite and PostgreSQL)
- Fix SQLite-specific raw queries:
  - health: pragma_page_count/page_size → pg_database_size()
  - maintenance: VACUUM, file-based backup → pg_dump for PostgreSQL
  - export: datetime("now", "-30 days") → NOW() - INTERVAL '30 days'
  - settings: ON CONFLICT(key) → ON CONFLICT (key)
- Switch Prisma provider from sqlite to postgresql
- Generate fresh init_pg migration for PostgreSQL
- Add PlanEntitlement model and missing indexes to Prisma schema (migration: add_plan_entitlement_and_indexes)
- Remove runtime DDL (CREATE TABLE/ALTER TABLE) from entitlements.js and api-key-policy.js
- Convert all raw SQL ? placeholders to $queryRaw/$executeRaw tagged templates (29 queries across 9 files)

2026-07-18 v6

- Add MIGRATION.md with SQLite to PostgreSQL data migration guide
- Add data migration standards to AGENTS.md (dual-adapter pattern, row count verification)
- Write scripts/migrate-from-sqlite.mjs with full dual-adapter migration script
  - Auto-detects optional tables/columns (PlanEntitlement, TokenUsage.packageId)
  - Inserts in dependency order, skips duplicates, handles FK orphans
  - Includes verify() function for row count checks
