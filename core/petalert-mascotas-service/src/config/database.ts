import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
export const pool = new pg.Pool({
  host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME,
  user: env.DB_USER, password: env.DB_PASSWORD,
  max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000,
  statement_timeout: 10000
});
pool.on('error', () => logger.error('Conexion PostgreSQL interrumpida'));
