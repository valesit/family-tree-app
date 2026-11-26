/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const local = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(connectionString);
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(96402732)');
    await client.query('ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedById" TEXT, ADD COLUMN IF NOT EXISTS "deletionReason" TEXT');
    await client.query('CREATE INDEX IF NOT EXISTS "Person_deletedAt_idx" ON "Person" ("deletedAt")');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}
main().catch(error => { console.error('Person archive schema setup failed:', error.message); process.exitCode = 1; });
