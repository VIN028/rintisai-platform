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

2026-07-19 v7

- Add `disabled` field to User model (Boolean @default(false)) with migration
- Block disabled users from logging in (login/route.js returns 403)
- Add POST /api/admin/users to create users by admin (auto-generates password if not provided)
- Add PATCH /api/admin/users/[id] to edit user email, name, and toggle disabled status
  - Prevents disabling the last active admin
  - Validates email uniqueness across users
- Add `disabled` field to GET /api/admin/users and GET /api/admin/users/[id] responses
- Add disable/enable actions to /api/admin/bulk (bulk disable/enable users)
  - Prevents bulk-disabling all admins

2026-07-19 v8

- Add disabled badge and "New User" button + modal to admin users list page
- Add name, email, and disabled toggle inputs to user detail page
- Save now calls PATCH /api/admin/users (subscription) + PATCH /api/admin/users/[id] (user fields) in parallel
- Add bulk disable/enable buttons to the list page action bar

2026-07-19 v9

- Fix textarea scroll: change overflow-y-hidden to overflow-y-auto, max height 200→360px
- Track finish_reason/stop_reason from upstream SSE (OpenAI + Anthropic)
- Forward finishReason to client before [DONE] when not stop/end_turn
- Show amber warning banner on truncated responses (finish_reason=length)
