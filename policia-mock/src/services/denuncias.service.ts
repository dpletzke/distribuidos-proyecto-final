import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { pool, connection } from '../config/database.js';
import { env } from '../config/env.js';
import { repository } from '../repositories/denuncias.repository.js';
import { evidencias } from '../repositories/evidencias.repository.js';
import { validateFiles } from '../middlewares/upload.middleware.js';
import { ApiError, notFound } from '../utils/errors.js';
import type { DenunciaInput } from '../models/denuncia.model.js';
import { cleanFiles, diskPath, FILE_LOCK } from './files.service.js';
import { logger } from '../utils/logger.js';
export const service={
  list:repository.list,
  async get(id:string){const r=await repository.get(id);if(!r)throw notFound(id);return r;},
  async save(data:DenunciaInput,files:Express.Multer.File[],existingId?:string) {
    const validated=await validateFiles(files);
    const client=await pool.connect();let transaction=false;
    // Conexion dedicada: la cola no debe esperar por un pool lleno de escritores bloqueados.
    const journal=validated.length?new pg.Client({...connection,database:env.DB_NAME}):undefined;
    try {
      await client.query('SELECT pg_advisory_lock($1)',[FILE_LOCK]);
      await journal?.connect();
      await client.query('BEGIN');transaction=true;
      const previous=existingId?await repository.get(existingId,client,true):undefined;
      if(existingId&&!previous)throw notFound(existingId);
      const id=existingId??await repository.create(data,client);
      const count=await evidencias.count(client,id);
      if(count+validated.filter(f=>f.field==='evidencias').length>env.MAX_EVIDENCES_PER_DENUNCIA) throw new ApiError(400,'LIMITE_EVIDENCIAS','Una denuncia admite máximo cinco evidencias en total.');
      if(existingId)await repository.update(id,data,client);
      for(const file of validated) {
        const ruta=`${id}/${file.field==='evidencias'?'evidencias/':''}${randomUUID()}.${file.extension}`;
        // Otra conexion confirma la cola ANTES de escribir; no depende del COMMIT principal.
        await journal!.query('INSERT INTO file_cleanup(ruta) VALUES ($1)',[ruta]);
        await mkdir(path.dirname(diskPath(ruta)),{recursive:true});
        await writeFile(diskPath(ruta),file.buffer,{flag:'wx'});
        if(file.field==='foto') {
          await repository.photo(id,ruta,client);
          if(previous?.foto)await client.query('INSERT INTO file_cleanup(ruta) VALUES ($1) ON CONFLICT DO NOTHING',[previous.foto]);
        } else await evidencias.add(client,id,ruta,file);
        await client.query('DELETE FROM file_cleanup WHERE ruta=$1',[ruta]);
      }
      const result=await repository.get(id,client);
      await client.query('COMMIT');transaction=false;return result;
    } catch(e){if(transaction)await client.query('ROLLBACK').catch(()=>{});throw e;}
    finally {
      await journal?.end().catch(()=>{});
      try{await client.query('SELECT pg_advisory_unlock($1)',[FILE_LOCK]);}finally{client.release();}
      await cleanFiles().catch(()=>logger.error('Limpieza de archivos pendiente'));
    }
  }
};
