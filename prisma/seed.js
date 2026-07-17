import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const dbUrl = `file:${path.resolve(process.cwd(), 'dev.db')}`;
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  const prisma = new PrismaClient({ adapter });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString("hex");
  const userEmail = process.env.SEED_USER_EMAIL || "test@example.com";
  const userPassword = process.env.SEED_USER_PASSWORD || crypto.randomBytes(12).toString("hex");

  console.log('Clearing database...');
  await prisma.user.deleteMany({});
  
  console.log('Hashing passwords...');
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const userHash = await bcrypt.hash(userPassword, 10);

  console.log('Creating users...');
  const user = await prisma.user.create({
    data: {
      email: userEmail,
      password: userHash,
      name: 'User Demo',
      role: 'USER',
      subscription: {
        create: { plan: 'starter', status: 'active', expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: adminHash,
      name: 'Administrator',
      role: 'ADMIN',
      subscription: {
        create: { plan: 'developer', status: 'active', apiAccessEnabled: true, expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
      },
    },
  });

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('\n⚠️  ADMIN PASSWORD (auto-generated):', adminPassword);
    console.log('   Save this! Set SEED_ADMIN_PASSWORD= in .env to use a custom one.\n');
  }

  console.log('Seeded database successfully:', { user: user.email, admin: admin.email });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
