import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  // For Prisma 7+, we need to use an adapter
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function createLazyPrismaClient(): PrismaClient {
  /**
   * IMPORTANT:
   * Next.js / Vercel may import server modules during build-time evaluation.
   * If DATABASE_URL is not set at build time, we don't want to crash the build immediately.
   * Instead, we lazily throw only when Prisma is actually used.
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
