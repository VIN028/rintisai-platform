# Database Migration Guide

This document covers migrating the RintisAI database between providers (SQLite to PostgreSQL or vice versa).

## When to Use

- Moving from local SQLite development to production PostgreSQL
- Restoring a production backup to a local SQLite environment
- Switching between provider-specific features during development

## Prerequisites

- Old database file (e.g. `dev.db` or any SQLite file)
- Target PostgreSQL database running and migrated
- Node.js 20+ installed
- Environment variables configured

## Migration Script

The canonical migration script is `scripts/migrate-from-sqlite.mjs`. It uses Prisma's dual-adapter pattern -- reading from SQLite via `PrismaBetterSqlite3` and writing to PostgreSQL via `PrismaPg`.

### Running the Migration

```bash
# 1. Backup existing data
cp dev.db dev.db.backup.$(date +%Y%m%d)

# 2. Make sure PostgreSQL target is ready and migrations are applied
npx prisma migrate deploy

# 3. Set DATABASE_URL to the PostgreSQL target in .env
#    DATABASE_URL="postgresql://user:password@host:5432/rintisai"

# 4. Run the migration script
node scripts/migrate-from-sqlite.mjs

# 5. Verify row counts match
node -e "
import('scripts/migrate-from-sqlite.mjs' + '?' + Date.now()).then(m => m.verify());
"

# 6. Run seed to create demo/admin users (safe -- existing users are skipped)
npm run seed

# 7. Restart dev server and test login
npm run dev
```

## How It Works

The script connects to two databases simultaneously:

1. **Source (SQLite)** -- reads all rows from every table
2. **Target (PostgreSQL)** -- inserts rows in dependency order to respect foreign keys

### Table Insertion Order

```
Setting                    (no dependencies)
User                       (no dependencies)
  Subscription             (FK -> User)
  ApiKey                   (FK -> User)
  Conversation             (FK -> User)
    Message                (FK -> Conversation)
  UpgradeRequest           (FK -> User)
  CashoutRequest           (FK -> User)
  TokenUsage               (FK -> User)
  ApiCreditLedger          (FK -> User)
  PlanEntitlement          (FK -> User, may not exist in source)
```

### Automatic Type Transformations

| Source (SQLite) | Target (PostgreSQL) | How |
|-----------------|---------------------|-----|
| INTEGER 0/1 for booleans | BOOLEAN | Prisma client auto-coerces |
| ISO-8601 strings for dates | TIMESTAMP(3) | Prisma client auto-coerces |
| TEXT for strings | TEXT | Direct copy |
| INTEGER for numbers | INTEGER | Direct copy |
| TEXT for UUIDs | TEXT | Direct copy |

### Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| `PlanEntitlement` table does not exist in source | Detected via `sqlite_master` -- silently skipped |
| `TokenUsage.packageId` column does not exist | All rows get `NULL` for `packageId` |
| Row already exists in target (duplicate email, key) | Skipped via `ON CONFLICT DO NOTHING` for unique constraints |
| Foreign key violation | Avoided by correct insertion order |

## Verification

After migration, run these checks:

```bash
# Count all tables
psql "$DATABASE_URL" -c "
  SELECT 'User', COUNT(*) FROM \"User\"
  UNION ALL SELECT 'Subscription', COUNT(*) FROM \"Subscription\"
  UNION ALL SELECT 'TokenUsage', COUNT(*) FROM \"TokenUsage\"
  UNION ALL SELECT 'ApiKey', COUNT(*) FROM \"ApiKey\"
  UNION ALL SELECT 'Conversation', COUNT(*) FROM \"Conversation\"
  UNION ALL SELECT 'Message', COUNT(*) FROM \"Message\"
  UNION ALL SELECT 'PlanEntitlement', COUNT(*) FROM \"PlanEntitlement\"
  UNION ALL SELECT 'Setting', COUNT(*) FROM \"Setting\"
  ORDER BY 1;
"
```

## Rollback

If something goes wrong:

```bash
# 1. Drop and recreate the PostgreSQL database
su - postgres -c "psql -c 'DROP DATABASE rintisai; CREATE DATABASE rintisai OWNER rintisai_user;'"

# 2. Re-run migrations
npx prisma migrate deploy

# 3. Restore from backup
cp dev.db.backup.20260718 dev.db

# 4. Update .env to point back to SQLite
#    DATABASE_URL="file:./dev.db"

# 5. Restart dev server
npm run dev
```

## Troubleshooting

### "PlanEntitlement table not found in source"

This is expected if the old SQLite database never ran `ensureEntitlementSchema()`. The table was created at runtime by the old `entitlements.js`. The migration script detects this and skips the table. No action needed.

### "TokenUsage.packageId column not found"

Same as above -- the column was added via runtime `ALTER TABLE`. The script detects its absence and sets all `packageId` values to `NULL`.

### "Unique constraint violation on email"

If the target already has a user (e.g. from a previous seed), the script skips duplicates via `ON CONFLICT DO NOTHING`. Run `npm run seed` after migration to ensure the admin user exists with the correct credentials.

### Migration script fails partway through

The script does not use transactions (to avoid locking large tables). If it fails mid-way, fix the issue and re-run. Duplicate rows are skipped via `ON CONFLICT DO NOTHING`.

## Writing a New Migration Script

If you need to migrate between other providers (e.g. PostgreSQL to MySQL, or between two PostgreSQL instances), follow the same pattern:

1. Create a new file `scripts/migrate-<from>-to-<to>.mjs`
2. Connect to both databases using Prisma adapters
3. Read all data from source in dependency order
4. Transform any provider-specific types
5. Write to target in dependency order
6. Add an entry to this document describing the migration
