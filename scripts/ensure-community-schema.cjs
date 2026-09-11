/* eslint-disable @typescript-eslint/no-require-imports -- This standalone build script runs as Node CommonJS. */
// Idempotent, additive setup for repositories predating Prisma migration history.
// This script creates only the five community tables. Never use db push/reset here.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('Community schema setup skipped: no database configured for this build.');
    return;
  }
  const local = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(connectionString);
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(96402731)');
    const tables = ['ForumPost', 'ForumImage', 'ForumComment', 'BusinessListing', 'CommunityRateLimit'];
    const result = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = ANY($1::text[])', [tables]);
    if (result.rows.length === tables.length) {
      console.log('Community tables already exist.');
    } else if (result.rows.length !== 0) {
      throw new Error('Only some community tables exist. Review their schema before continuing. No changes were applied.');
    } else {
      await client.query(readFileSync(join(__dirname, '../prisma/community/001_forum_and_support.sql'), 'utf8'));
      console.log('Created the five community tables. Existing family and photo tables are unchanged.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

main().catch(error => { console.error('Community schema setup failed:', error.message); process.exitCode = 1; });
