import path from 'node:path';
import { unlink, rmdir } from 'node:fs/promises';
import { pool } from '../config/database.js';
import { uploadDir } from '../config/env.js';
import { logger } from '../utils/logger.js';
export const FILE_LOCK=824902;
export function diskPath(ruta:string) {
  if(!/^[1-9][0-9]*\/(evidencias\/)?[a-f0-9-]{36}\.(jpg|png|webp|pdf|mp4)$/.test(ruta)) throw new Error('Ruta de archivo inválida');
  return path.join(uploadDir,ruta);
}
export async function cleanFiles() {
  const client=await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)',[FILE_LOCK]);
    for(const {ruta} of (await client.query('SELECT ruta FROM file_cleanup')).rows) {
      const used=await client.query('SELECT 1 FROM "Denuncias" WHERE foto=$1 UNION ALL SELECT 1 FROM "DenunciaEvidencias" WHERE ruta_archivo=$1',[ruta]);
      if(!used.rowCount) {
        const file=diskPath(ruta);
        try {await unlink(file);} catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT'){logger.error('Limpieza pendiente');continue;}}
        await rmdir(path.dirname(file)).catch(()=>{});
      }
      await client.query('DELETE FROM file_cleanup WHERE ruta=$1',[ruta]);
    }
  } finally {try{await client.query('SELECT pg_advisory_unlock($1)',[FILE_LOCK]);}finally{client.release();}}
}
