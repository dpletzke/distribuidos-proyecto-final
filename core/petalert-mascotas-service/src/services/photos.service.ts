import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import { uploadDir } from '../config/env.js';
import { logger } from '../utils/logger.js';
export const PHOTO_LOCK = 724902;
function localPhoto(ruta: string | null): ruta is string {
  return !!ruta && /^\/uploads\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(ruta);
}
export function diskPath(ruta: string) {
  if (!localPhoto(ruta)) throw new Error('Ruta local invalida');
  return path.join(uploadDir, path.basename(ruta));
}
export async function enqueue(client: PoolClient, ruta: string | null) {
  if (localPhoto(ruta)) await client.query('INSERT INTO foto_cleanup(ruta) VALUES ($1) ON CONFLICT DO NOTHING', [ruta]);
}
export async function cleanPhotos() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [PHOTO_LOCK]);
    const pending = await client.query<{ ruta: string }>('SELECT ruta FROM foto_cleanup');
    for (const { ruta } of pending.rows) {
      const used = await client.query('SELECT 1 FROM "Mascotas" WHERE foto=$1', [ruta]);
      if (!used.rowCount && localPhoto(ruta)) {
        try { await unlink(diskPath(ruta)); }
        catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') { logger.error('Limpieza de foto pendiente'); continue; } }
      }
      await client.query('DELETE FROM foto_cleanup WHERE ruta=$1', [ruta]);
    }
  } finally { try { await client.query('SELECT pg_advisory_unlock($1)', [PHOTO_LOCK]); } finally { client.release(); } }
}
