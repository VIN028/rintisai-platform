import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const SRC = process.argv[2] || './dev.db';
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL || (!DB_URL.startsWith('postgresql://') && !DB_URL.startsWith('postgres://'))) {
  console.error('ERROR: DATABASE_URL must point to a PostgreSQL database');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step, msg) {
  console.log(`[${step.padEnd(18)}] ${msg}`);
}

function hasTable(db, name) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return !!row;
}

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all();
  return cols.some((c) => c.name === column);
}

function asBool(v) {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

// ---------------------------------------------------------------------------
// Parsed row readers (transform SQLite TEXT dates / 0-1 bools to JS values)
// ---------------------------------------------------------------------------

function readUsers(rows) {
  return rows.map((r) => ({
    id: r.id, email: r.email, password: r.password,
    name: r.name ?? null, role: r.role ?? 'USER',
    assignedApiKey: r.assignedApiKey ?? null,
    resetCode: r.resetCode ?? null,
    resetCodeExpires: r.resetCodeExpires ?? null,
    emailVerifiedAt: r.emailVerifiedAt ?? null,
    emailVerifyToken: r.emailVerifyToken ?? null,
    emailVerifyExpires: r.emailVerifyExpires ?? null,
    tokenVersion: r.tokenVersion ?? 0,
    createdAt: r.createdAt ?? new Date(),
    updatedAt: r.updatedAt ?? new Date(),
  }));
}

function readSubscriptions(rows) {
  return rows.map((r) => ({
    id: r.id, userId: r.userId,
    plan: r.plan ?? 'starter', billingInterval: r.billingInterval ?? 'monthly',
    status: r.status ?? 'inactive', expiryDate: r.expiryDate ?? new Date(),
    apiAccessEnabled: asBool(r.apiAccessEnabled),
    customLimit5h: r.customLimit5h ?? null,
    customLimitWeekly: r.customLimitWeekly ?? null,
    customLimitMonthly: r.customLimitMonthly ?? null,
    apiCreditBalanceRp: r.apiCreditBalanceRp ?? 0,
    apiCreditBalanceUsdMicros: r.apiCreditBalanceUsdMicros ?? 0,
    createdAt: r.createdAt ?? new Date(),
    updatedAt: r.updatedAt ?? new Date(),
  }));
}

function readApiKeys(rows) {
  return rows.map((r) => ({
    id: r.id, key: r.key,
    encryptedKey: r.encryptedKey ?? null,
    name: r.name ?? 'VS Code Key',
    providerScope: r.providerScope ?? 'all',
    quotaUsdMicros: r.quotaUsdMicros ?? 0,
    status: r.status ?? 'active',
    userId: r.userId,
    createdAt: r.createdAt ?? new Date(),
  }));
}

function readConversations(rows) {
  return rows.map((r) => ({
    id: r.id, userId: r.userId,
    title: r.title ?? 'Percakapan Baru',
    shared: asBool(r.shared),
    createdAt: r.createdAt ?? new Date(),
    updatedAt: r.updatedAt ?? new Date(),
  }));
}

function readMessages(rows) {
  return rows.map((r) => ({
    id: r.id, conversationId: r.conversationId,
    role: r.role, content: r.content,
    createdAt: r.createdAt ?? new Date(),
  }));
}

function readUpgradeRequests(rows) {
  return rows.map((r) => ({
    id: r.id, userId: r.userId, plan: r.plan,
    billingInterval: r.billingInterval ?? 'monthly',
    paymentMethod: r.paymentMethod, paymentRef: r.paymentRef ?? null,
    paymentProof: r.paymentProof ?? null, uniqueCode: r.uniqueCode ?? null,
    transferAmount: r.transferAmount ?? null,
    status: r.status ?? 'pending', note: r.note ?? null,
    adminActionBy: r.adminActionBy ?? null,
    adminActionAt: r.adminActionAt ?? null,
    confirmedAt: r.confirmedAt ?? null,
    completedAt: r.completedAt ?? null,
    rejectedAt: r.rejectedAt ?? null,
    createdAt: r.createdAt ?? new Date(),
  }));
}

function readCashoutRequests(rows) {
  return rows.map((r) => ({
    id: r.id, userId: r.userId,
    amountUsdMicros: r.amountUsdMicros, amountRp: r.amountRp,
    feeRp: r.feeRp ?? 0, payoutAmountRp: r.payoutAmountRp ?? 0,
    fxRate: r.fxRate, payoutMethod: r.payoutMethod,
    payoutRef: r.payoutRef ?? null,
    status: r.status ?? 'pending', reason: r.reason ?? null,
    adminActionBy: r.adminActionBy ?? null,
    adminActionAt: r.adminActionAt ?? null,
    confirmedAt: r.confirmedAt ?? null,
    completedAt: r.completedAt ?? null,
    rejectedAt: r.rejectedAt ?? null,
    createdAt: r.createdAt ?? new Date(),
  }));
}

function readTokenUsage(rows, hasPackageId) {
  return rows.map((r) => ({
    id: r.id, userId: r.userId,
    timestamp: r.timestamp ?? new Date(),
    modelUsed: r.modelUsed, promptTokens: r.promptTokens,
    completionTokens: r.completionTokens, totalTokens: r.totalTokens,
    source: r.source ?? 'web', apiKeyId: r.apiKeyId ?? null,
    providerPool: r.providerPool ?? null,
    fallbackUsed: asBool(r.fallbackUsed),
    packageId: hasPackageId ? (r.packageId ?? null) : null,
  }));
}

function readApiCreditLedger(rows) {
  return rows.map((r) => ({
    id: r.id, userId: r.userId, type: r.type,
    amountRp: r.amountRp, amountUsdMicros: r.amountUsdMicros ?? 0,
    fxRate: r.fxRate ?? null, modelUsed: r.modelUsed ?? null,
    promptTokens: r.promptTokens ?? 0,
    completionTokens: r.completionTokens ?? 0,
    apiKeyId: r.apiKeyId ?? null, providerPool: r.providerPool ?? null,
    fallbackUsed: asBool(r.fallbackUsed),
    note: r.note ?? null,
    createdAt: r.createdAt ?? new Date(),
  }));
}

function readPlanEntitlement(rows) {
  return rows.map((r) => ({
    id: r.id, userId: r.userId, plan: r.plan, family: r.family,
    billingInterval: r.billingInterval,
    status: r.status ?? 'active',
    startsAt: r.startsAt ?? new Date(),
    expiresAt: r.expiresAt ?? new Date(),
    activatedAt: r.activatedAt ?? null,
    sourceRequestId: r.sourceRequestId ?? null,
    limitUnits: r.limitUnits ?? null,
    createdAt: r.createdAt ?? new Date(),
    updatedAt: r.updatedAt ?? new Date(),
  }));
}

function readSettings(rows) {
  return rows.map((r) => ({ key: r.key, value: r.value }));
}

// ---------------------------------------------------------------------------
// Writers (insert into PostgreSQL, skip duplicates)
// ---------------------------------------------------------------------------

async function insertAll(pg, model, rows, conflictCol) {
  if (rows.length === 0) { log(model, '0 rows (skipped)'); return; }
  let ok = 0, skip = 0, err = 0;
  for (const row of rows) {
    try {
      await pg[model].create({ data: row });
      ok++;
    } catch (e) {
      if (e.code === 'P2002') { skip++; } // unique constraint
      else { err++; console.error(`  ${model} insert error:`, e.message?.slice(0, 120)); }
    }
  }
  log(model, `${ok} inserted, ${skip} skipped (duplicates), ${err} errors`);
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export async function verify() {
  const pg = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL }) });
  const tables = ['User', 'Subscription', 'ApiKey', 'Conversation', 'Message',
    'UpgradeRequest', 'CashoutRequest', 'TokenUsage', 'ApiCreditLedger',
    'PlanEntitlement', 'Setting'];
  log('VERIFY', '---');
  for (const t of tables) {
    try {
      const count = await pg.$queryRawUnsafe(`SELECT COUNT(*) as c FROM "${t}"`);
      log('VERIFY', `  ${t.padEnd(22)} ${count[0].c}`);
    } catch { log('VERIFY', `  ${t.padEnd(22)} (not found)`); }
  }
  await pg.$disconnect();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  log('SOURCE', path.resolve(SRC));
  log('TARGET', DB_URL.replace(/\/\/.*@/, '//***@'));
  console.log('');

  // ---- Connect to source (SQLite via better-sqlite3) ----
  const src = new Database(SRC);
  src.pragma('journal_mode = WAL');

  // ---- Connect to target (PostgreSQL via Prisma) ----
  const pg = new PrismaClient({ adapter: new PrismaPg({ connectionString: DB_URL }) });

  // ---- Check optional tables / columns ----
  const hasPE = hasTable(src, 'PlanEntitlement');
  const hasPackageId = hasColumn(src, 'TokenUsage', 'packageId');
  log('CHECK', `PlanEntitlement table: ${hasPE ? 'FOUND' : 'NOT FOUND'}`);
  log('CHECK', `TokenUsage.packageId  : ${hasPackageId ? 'FOUND' : 'NOT FOUND'}`);
  console.log('');

  // ---- Migrate tables in dependency order ----
  log('MIGRATE', 'Setting (no dependencies)');
  if (hasTable(src, 'Setting')) {
    const rows = readSettings(src.prepare('SELECT * FROM "Setting"').all());
    await insertAll(pg, 'setting', rows, 'key');
  }

  log('MIGRATE', 'User (no dependencies)');
  const users = readUsers(src.prepare('SELECT * FROM "User"').all());
  await insertAll(pg, 'user', users, 'email');
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  log('MIGRATE', 'Subscription (FK -> User)');
  if (hasTable(src, 'Subscription')) {
    const rows = readSubscriptions(src.prepare('SELECT * FROM "Subscription"').all());
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} subscriptions with missing userId skipped`);
    await insertAll(pg, 'subscription', valid, 'userId');
  }

  log('MIGRATE', 'ApiKey (FK -> User)');
  if (hasTable(src, 'ApiKey')) {
    const rows = readApiKeys(src.prepare('SELECT * FROM "ApiKey"').all());
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} apiKeys with missing userId skipped`);
    await insertAll(pg, 'apiKey', valid, 'key');
  }

  log('MIGRATE', 'Conversation (FK -> User)');
  if (hasTable(src, 'Conversation')) {
    const rows = readConversations(src.prepare('SELECT * FROM "Conversation"').all());
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} conversations with missing userId skipped`);
    await insertAll(pg, 'conversation', valid, 'id');
  }

  log('MIGRATE', 'Message (FK -> Conversation)');
  if (hasTable(src, 'Message')) {
    const convIds = new Set(src.prepare('SELECT id FROM "Conversation"').all().map((r) => r.id));
    const rows = readMessages(src.prepare('SELECT * FROM "Message"').all());
    const valid = rows.filter((r) => convIds.has(r.conversationId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} messages with missing conversationId skipped`);
    await insertAll(pg, 'message', valid, 'id');
  }

  log('MIGRATE', 'UpgradeRequest (FK -> User)');
  if (hasTable(src, 'UpgradeRequest')) {
    const rows = readUpgradeRequests(src.prepare('SELECT * FROM "UpgradeRequest"').all());
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} upgradeRequests with missing userId skipped`);
    await insertAll(pg, 'upgradeRequest', valid, 'id');
  }

  log('MIGRATE', 'CashoutRequest (FK -> User)');
  if (hasTable(src, 'CashoutRequest')) {
    const rows = readCashoutRequests(src.prepare('SELECT * FROM "CashoutRequest"').all());
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} cashoutRequests with missing userId skipped`);
    await insertAll(pg, 'cashoutRequest', valid, 'id');
  }

  log('MIGRATE', 'TokenUsage (FK -> User)');
  if (hasTable(src, 'TokenUsage')) {
    const sql = hasPackageId
      ? 'SELECT * FROM "TokenUsage"'
      : 'SELECT *, NULL as packageId FROM "TokenUsage"';
    const rows = readTokenUsage(src.prepare(sql).all(), hasPackageId);
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} tokenUsage with missing userId skipped`);
    await insertAll(pg, 'tokenUsage', valid, 'id');
  }

  log('MIGRATE', 'ApiCreditLedger (FK -> User)');
  if (hasTable(src, 'ApiCreditLedger')) {
    const rows = readApiCreditLedger(src.prepare('SELECT * FROM "ApiCreditLedger"').all());
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} apiCreditLedger with missing userId skipped`);
    await insertAll(pg, 'apiCreditLedger', valid, 'id');
  }

  log('MIGRATE', 'PlanEntitlement (FK -> User)');
  if (hasPE && hasTable(src, 'PlanEntitlement')) {
    const rows = readPlanEntitlement(src.prepare('SELECT * FROM "PlanEntitlement"').all());
    const valid = rows.filter((r) => userMap.has(r.userId));
    if (valid.length < rows.length) log('WARN', `${rows.length - valid.length} planEntitlements with missing userId skipped`);
    await insertAll(pg, 'planEntitlement', valid, 'id');
  }

  console.log('');
  log('DONE', 'Migration complete. Run verify() to check row counts.');

  await src.close();
  await pg.$disconnect();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
