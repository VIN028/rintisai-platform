import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

let prisma;

function getDbUrl() {
  return process.env.DATABASE_URL || `file:${path.resolve(process.cwd(), 'dev.db')}`;
}

function createClient() {
  const url = getDbUrl();

  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    const { PrismaPg } = require('@prisma/adapter-pg');
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }

  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

if (process.env.NODE_ENV === 'production') {
  prisma = createClient();
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = createClient();
  }
  prisma = global.cachedPrisma;
}

export default prisma;
