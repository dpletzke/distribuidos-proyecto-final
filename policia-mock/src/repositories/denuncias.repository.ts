import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import { publicId, type DenunciaInput } from '../models/denuncia.model.js';
import type { Filters } from '../validators/denuncias.validator.js';
const fields=['nombre','raza','color','collar_gps','nombre_denunciante','telefono','correo','descripcion_denuncia','tipo_denuncia'] as const;
const select = `SELECT d.*, COALESCE((SELECT jsonb_agg(to_jsonb(e) || jsonb_build_object('id',e.id::text,'denuncia_id',e.denuncia_id::text) ORDER BY e.id) FROM "DenunciaEvidencias" e WHERE e.denuncia_id=d.id),'[]'::jsonb) AS evidencias FROM "Denuncias" d`;
const map=(r:any)=>({...r,id:publicId(r.id),tipo_denuncia_descripcion:r.tipo_denuncia===1?'Pérdida':'Maltrato',evidencias:r.evidencias.map((e:any)=>({...e,id:publicId(e.id),denuncia_id:publicId(e.denuncia_id),tamano_bytes:Number(e.tamano_bytes)}))});
export const repository = {
  async get(id:string,client?:PoolClient,lock=false) {
    const r=await (client??pool).query(`${select} WHERE d.id=$1${lock?' FOR UPDATE OF d':''}`,[id]); return r.rows[0]?map(r.rows[0]):undefined;
  },
  async create(data:DenunciaInput,client:PoolClient) {
    return String((await client.query(`INSERT INTO "Denuncias" (${fields.join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,fields.map(k=>data[k]))).rows[0].id);
  },
  async update(id:string,data:DenunciaInput,client:PoolClient) {
    await client.query(`UPDATE "Denuncias" SET ${fields.map((k,i)=>`${k}=$${i+2}`).join(',')} WHERE id=$1`,[id,...fields.map(k=>data[k])]);
  },
  async photo(id:string,ruta:string,client:PoolClient) {await client.query('UPDATE "Denuncias" SET foto=$2 WHERE id=$1',[id,ruta]);},
  async list(f:Filters) {
    const conditions:string[]=[]; const values:unknown[]=[];
    const add=(sql:string,value:unknown)=>{values.push(value);conditions.push(sql.replace('?',`$${values.length}`));};
    if(f.tipo_denuncia) add('d.tipo_denuncia=?',f.tipo_denuncia);
    if(f.nombre) add('strpos(lower(d.nombre),lower(?))>0',f.nombre);
    if(f.collar_gps) add('d.collar_gps=?',f.collar_gps);
    if(f.fecha_desde) add('d.created_at>=?::timestamptz',f.fecha_desde);
    if(f.fecha_hasta) add('d.created_at<=?::timestamptz',f.fecha_hasta);
    const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
    const client=await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const total=Number((await client.query('SELECT count(*) FROM "Denuncias" d'+where,values)).rows[0].count);
      const rows=await client.query(`${select}${where} ORDER BY d.created_at DESC,d.id DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,f.limit,(f.page-1)*f.limit]);
      await client.query('COMMIT');return {total,page:f.page,limit:f.limit,data:rows.rows.map(map)};
    } catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;} finally{client.release();}
  }
};
