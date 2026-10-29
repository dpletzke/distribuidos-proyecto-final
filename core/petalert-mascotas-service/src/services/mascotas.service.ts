import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pool } from '../config/database.js';
import { repository } from '../repositories/mascotas.repository.js';
import type { MascotaInput } from '../models/mascota.model.js';
import { duplicate, notFound } from '../utils/errors.js';
import { validateImage } from '../middlewares/upload.middleware.js';
import { cleanPhotos, diskPath, enqueue, PHOTO_LOCK } from './photos.service.js';
import { logger } from '../utils/logger.js';
function translate(e: unknown, gps?: string | null): never {
  const error = e as { code?: string; constraint?: string };
  if (error.code === '23505' && error.constraint === 'uq_mascotas_collar_gps') throw duplicate(gps ?? '');
  throw e;
}
export const service = {
  list: () => repository.list(),
  async get(id: string) { const pet = await repository.get(id); if (!pet) throw notFound(); return pet; },
  async create(data: MascotaInput, file?: Express.Multer.File) {
    const decoded = file ? await validateImage(file) : undefined;
    if (data.collar_gps && await repository.gpsExists(data.collar_gps)) throw duplicate(data.collar_gps);
    if (!decoded) {
      try { return await repository.create(data); } catch (e) { return translate(e, data.collar_gps); }
    }
    const ruta = '/uploads/mascota-' + randomUUID() + '.' + decoded.extension;
    const client = await pool.connect();
    let transaction = false;
    try {
      await client.query('SELECT pg_advisory_lock($1)', [PHOTO_LOCK]);
      // Registro durable antes de escribir: el recolector recupera archivos si cae el proceso.
      await enqueue(client, ruta);
      await client.query('BEGIN'); transaction = true;
      await writeFile(diskPath(ruta), decoded.buffer, { flag: 'wx' });
      const pet = await repository.create({ ...data, foto: ruta }, client);
      await client.query('DELETE FROM foto_cleanup WHERE ruta=$1', [ruta]);
      await client.query('COMMIT'); transaction = false;
      return pet;
    } catch (e) {
      if (transaction) await client.query('ROLLBACK').catch(() => {});
      return translate(e, data.collar_gps);
    } finally {
      try { await client.query('SELECT pg_advisory_unlock($1)', [PHOTO_LOCK]); }
      finally { client.release(); }
      await cleanPhotos().catch(() => logger.error('Limpieza de fotos se reintentara'));
    }
  },
  async remove(id: string) {
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [PHOTO_LOCK]);
      await client.query('BEGIN');
      const pet = await repository.get(id, client, true);
      if (!pet) throw notFound();
      await repository.delete(id, client);
      await enqueue(client, pet.foto);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally {
      try { await client.query('SELECT pg_advisory_unlock($1)', [PHOTO_LOCK]); }
      finally { client.release(); }
      await cleanPhotos().catch(() => logger.error('Limpieza de fotos se reintentara'));
    }
  }
};
