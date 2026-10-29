import type { PoolClient } from 'pg';
import type { ValidatedFile } from '../models/evidencia.model.js';
export const evidencias = {
  async count(client:PoolClient,id:string) {return Number((await client.query('SELECT count(*) FROM "DenunciaEvidencias" WHERE denuncia_id=$1',[id])).rows[0].count);},
  async add(client:PoolClient,id:string,ruta:string,file:ValidatedFile) {
    await client.query('INSERT INTO "DenunciaEvidencias" (denuncia_id,nombre_archivo,ruta_archivo,tipo_archivo,tamano_bytes) VALUES ($1,$2,$3,$4,$5)',[id,file.original,ruta,file.mime,file.buffer.length]);
  }
};
