import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

let prisma;

const getDbUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dbPath = path.resolve(process.cwd(), 'dev.db');
  return `file:${dbPath}`;
};

if (process.env.NODE_ENV === 'production') {
  const adapter = new PrismaBetterSqlite3({ url: getDbUrl() });
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.cachedPrisma) {
    const adapter = new PrismaBetterSqlite3({ url: getDbUrl() });
    global.cachedPrisma = new PrismaClient({ adapter });
  }
  prisma = global.cachedPrisma;
}

export default prisma;
