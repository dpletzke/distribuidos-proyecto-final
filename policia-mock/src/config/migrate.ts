import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool } from './database.js';
import { logger } from '../utils/logger.js';
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(824901)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for (const version of (await readdir('database/migrations')).filter(f => f.endsWith('.sql')).sort()) {
      const sql = await readFile(`database/migrations/${version}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const old = await client.query('SELECT checksum FROM schema_migrations WHERE version=$1', [version]);
      if (old.rowCount) {
        if (old.rows[0].checksum !== checksum) throw new Error(`Migracion modificada: ${version}`);
        continue;
      }
      try { await client.query(sql); }
      catch (e) { logger.error(`Migracion ${version}: ${(e as Error).message}`); throw e; }
      await client.query('INSERT INTO schema_migrations(version,checksum) VALUES ($1,$2)', [version, checksum]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
