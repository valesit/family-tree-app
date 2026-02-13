import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('host.docker.internal');

  const isVercel = !!process.env.VERCEL;

  // Reuse pool across hot invocations in serverless (globalThis persists in warm lambdas)
  if (!globalThis.pgPool) {
    globalThis.pgPool = new Pool({
      connectionString,
      // Serverless: keep pool tiny; local dev can be slightly larger
      max: isVercel ? 1 : 3,
      idleTimeoutMillis: isVercel ? 10000 : 30000,
      connectionTimeoutMillis: 15000,
      // Serverless environments should NOT keep connections alive between invocations
      allowExitOnIdle: true,
      ...(isLocal
        ? {}
        : {
            ssl: { rejectUnauthorized: false },
          }),
    });
  }

  const adapter = new PrismaPg(globalThis.pgPool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function createLazyPrismaClient(): PrismaClient {
  /**
   * Next.js / Vercel may import server modules during build-time evaluation.
   * If DATABASE_URL is not set at build time we lazily throw only when Prisma is actually used.
   */
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      throw new Error(
        `Prisma client accessed without DATABASE_URL being set (attempted to access "${String(
          prop
        )}"). Set DATABASE_URL in your environment (Vercel Project → Settings → Environment Variables).`
      );
    },
  });
}

export const prisma =
  globalThis.prisma ||
  (process.env.DATABASE_URL ? createPrismaClient() : createLazyPrismaClient());

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;
