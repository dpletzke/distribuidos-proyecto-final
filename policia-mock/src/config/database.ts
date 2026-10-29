import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
export const connection = { host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 3000 };
export const pool = new pg.Pool({ ...connection, database: env.DB_NAME, max: 10, idleTimeoutMillis: 30000, statement_timeout: 15000 });
pool.on('error', () => logger.error('Conexion PostgreSQL interrumpida'));
export async function ensureDatabase() {
  const client = new pg.Client({ ...connection, database: 'postgres' });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(824900)');
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [env.DB_NAME]);
    // Nombre validado por env: nunca se interpola entrada HTTP.
    if (!exists.rowCount) await client.query(`CREATE DATABASE "${env.DB_NAME}"`);
  } finally { await client.end(); }
}
