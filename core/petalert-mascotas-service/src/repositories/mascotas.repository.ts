import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import type { Mascota, MascotaInput } from '../models/mascota.model.js';
const map = (row: Mascota): Mascota => ({ id: BigInt(row.id) <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(row.id) : String(row.id), nombre: row.nombre, raza: row.raza, color: row.color, collar_gps: row.collar_gps, foto: row.foto, coordenadas: row.coordenadas, created_at: row.created_at, updated_at: row.updated_at });
export const repository = {
  async list() { return (await pool.query<Mascota>('SELECT * FROM "Mascotas" ORDER BY id')).rows.map(map); },
  async get(id: string, client?: PoolClient, lock = false) {
    const r = await (client ?? pool).query<Mascota>(`SELECT * FROM "Mascotas" WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id]);
    return r.rows[0] ? map(r.rows[0]) : undefined;
  },
  async gpsExists(gps: string) {
    return (await pool.query('SELECT 1 FROM "Mascotas" WHERE collar_gps=$1', [gps])).rowCount !== 0;
  },
  async create(data: MascotaInput, client?: PoolClient) {
    return map((await (client ?? pool).query<Mascota>('INSERT INTO "Mascotas" (nombre,raza,color,collar_gps,foto,coordenadas) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [data.nombre, data.raza, data.color, data.collar_gps, data.foto, data.coordenadas])).rows[0]);
  },
  async delete(id: string, client: PoolClient) { await client.query('DELETE FROM "Mascotas" WHERE id=$1', [id]); }
};
