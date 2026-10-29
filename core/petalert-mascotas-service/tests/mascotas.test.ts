import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import pg from 'pg';
import sharp from 'sharp';

// Base REAL dedicada; nunca TRUNCATE ni DELETE sobre la base PetAlert del usuario.
const dbName = `petalert_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5433),
  user: process.env.DB_USER ?? 'petalert_user', password: process.env.DB_PASSWORD, database: 'postgres', connectionTimeoutMillis: 3000 });
let pool: pg.Pool; let server: Server; let base: string; let uploadDir: string; let created = false;
let id: number;
const pet = { nombre: 'Max', raza: 'Labrador', color: 'Dorado', collar_gps: 'CO-458', foto: null };
async function req(method: string, route = '', data?: unknown) {
  return fetch(`${base}/api/mascotas${route}`, { method, ...(data !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
}
async function photo(buffer: Uint8Array, filename = 'foto.png', mime = 'image/png', fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key,value] of Object.entries({nombre:'Con foto',raza:'Labrador',color:'Dorado',...fields})) form.append(key,value);
  form.append('foto', new Blob([new Uint8Array(buffer)], { type: mime }), filename);
  return fetch(base + '/api/mascotas', { method: 'POST', body: form });
}
before(async () => {
  assert.match(dbName, /^petalert_test_[a-f0-9]{32}$/);
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  uploadDir = await mkdtemp(path.join(tmpdir(), 'petalert-test-'));
  process.env.DB_HOST ??= 'localhost'; process.env.DB_PORT ??= '5433'; process.env.DB_USER ??= 'petalert_user';
  process.env.DB_NAME = dbName; process.env.UPLOAD_DIR = uploadDir;
  pool = (await import('../src/config/database.js')).pool;
  await (await import('../src/config/migrate.js')).migrate();
  const { app } = await import('../src/app.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (pool) await pool.end();
  if (created) await admin.query(`DROP DATABASE "${dbName}"`);
  await admin.end();
  if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
});
test('1. crea mascota con CO-458 y persiste auditoría en PostgreSQL', async () => {
  const r = await req('POST', '', pet); assert.equal(r.status, 201); const body = await r.json(); id = body.id;
  assert.equal(body.collar_gps, 'CO-458'); assert.ok(body.created_at); assert.ok(body.updated_at);
  assert.equal((await pool.query('SELECT nombre FROM "Mascotas" WHERE id=$1', [id])).rows[0].nombre, 'Max');
});
test('2 y 16. duplicados normalizados devuelven 409', async () => {
  for (const gps of ['CO-458', 'co-458', ' co-458 ']) {
    const r = await req('POST', '', { ...pet, collar_gps: gps }); assert.equal(r.status, 409);
    assert.equal((await r.json()).codigo, 'GPS_DUPLICADO');
  }
});
test('3 y 4. varias mascotas sin GPS', async () => {
  for (let n = 0; n < 3; n++) { const r = await req('POST', '', { ...pet, collar_gps: null }); assert.equal(r.status, 201); }
});
test('5 y 6. lista ordenada y consulta individual', async () => {
  const r = await req('GET'); assert.equal(r.status, 200); const rows = await r.json();
  assert.equal(rows.length, 4); assert.deepEqual(rows.map((p: {id:number}) => p.id), rows.map((p: {id:number}) => p.id).sort((a:number,b:number)=>a-b));
  const one = await req('GET', `/${id}`); assert.equal(one.status, 200); assert.equal((await one.json()).nombre, 'Max');
});
test('7. IDs inexistentes e inválidos', async () => {
  for (const method of ['GET', 'DELETE']) assert.equal((await req(method, '/9223372036854775807')).status, 404);
  for (const invalid of ['0', '-1', 'abc', '9223372036854775808']) assert.equal((await req('GET', `/${invalid}`)).status, 400);
});
test('solo cuatro operaciones: actualizacion y carga separada no disponibles', async () => {
  for (const method of ['PUT','PATCH']) assert.equal((await req(method, '/' + id, pet)).status,404);
  assert.equal((await req('POST', '/' + id + '/foto')).status,404);
});
test('campos obligatorios vacios y JSON invalido', async () => {
  assert.equal((await req('POST', '', { ...pet, nombre: ' ' })).status, 400);
  assert.equal((await fetch(`${base}/api/mascotas`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{' })).status, 400);
});
test('registro multipart con PNG/JPEG/WEBP y borrado limpia la foto', async () => {
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const data = await sharp({create:{width:4,height:4,channels:3,background:'#0099ff'}}).toFormat(format).toBuffer();
    const r = await photo(data, 'foto.' + format, 'image/' + format); assert.equal(r.status, 201); const body = await r.json();
    assert.equal(body.nombre,'Con foto'); assert.equal(body.collar_gps,null);
    assert.match(body.foto, /^\/uploads\/mascota-/); assert.equal((await fetch(base + body.foto)).status, 200);
    const stored=await pool.query('SELECT foto FROM "Mascotas" WHERE id=$1',[body.id]); assert.equal(stored.rows[0].foto,body.foto);
    assert.equal((await req('DELETE','/' + body.id)).status,204);
    assert.equal((await fetch(base+body.foto)).status,404);
  }
  assert.equal((await readdir(uploadDir)).length, 0);
});
test('registro multipart sin foto, GPS normalizado y campos opcionales omitidos', async () => {
  const form = new FormData(); form.append('nombre','Sin foto'); form.append('raza','R'); form.append('color','C'); form.append('collar_gps',' form-001 ');
  const r=await fetch(base+'/api/mascotas',{method:'POST',body:form}); assert.equal(r.status,201);
  const pet=await r.json(); assert.equal(pet.foto,null); assert.equal(pet.collar_gps,'FORM-001');
  await req('DELETE','/'+pet.id);
});
test('fotos invalidas o datos invalidos no crean registros ni archivos', async () => {
  const before=(await pool.query('SELECT count(*) FROM "Mascotas"')).rows[0].count;
  const valid = await sharp({create:{width:1,height:1,channels:3,background:'red'}}).png().toBuffer();
  assert.equal((await photo(Buffer.from('no es foto'))).status,415);
  assert.equal((await photo(valid,'foto.jpg','image/jpeg')).status,415);
  assert.equal((await photo(valid,'foto.txt')).status,415);
  assert.equal((await photo(Buffer.alloc(5*1024*1024+1))).status,413);
  assert.equal((await photo(valid,'foto.png','image/png',{nombre:''})).status,400);
  assert.equal((await photo(valid,'foto.png','image/png',{collar_gps:''})).status,400);
  assert.equal((await photo(valid,'foto.png','image/png',{foto:'https://example.com/foto.png'})).status,400);
  assert.equal((await photo(valid,'foto.png','image/png',{collar_gps:' co-458 '})).status,409);
  assert.equal((await pool.query('SELECT count(*) FROM "Mascotas"')).rows[0].count,before);
  assert.equal((await readdir(uploadDir)).length,0);
});
test('fallo SQL despues de escribir foto revierte registro y limpia archivo', async () => {
  await pool.query(`CREATE FUNCTION fail_test_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$`);
  await pool.query('CREATE TRIGGER fail_test BEFORE INSERT ON "Mascotas" FOR EACH ROW EXECUTE FUNCTION fail_test_insert()');
  try {
    const valid=await sharp({create:{width:1,height:1,channels:3,background:'red'}}).png().toBuffer();
    assert.equal((await photo(valid)).status,500);
    assert.equal((await readdir(uploadDir)).length,0);
    assert.equal((await pool.query('SELECT count(*) FROM foto_cleanup')).rows[0].count,'0');
  } finally { await pool.query('DROP TRIGGER fail_test ON "Mascotas"'); await pool.query('DROP FUNCTION fail_test_insert()'); }
});
test('17. carreras simultáneas crean exactamente un registro', async () => {
  const rs = await Promise.all(Array.from({length:8},()=>req('POST','',{...pet,collar_gps:'RACE-001'})));
  assert.equal(rs.filter(r=>r.status===201).length,1); assert.equal(rs.filter(r=>r.status===409).length,7);
});
test('PostgreSQL impide duplicados y formatos inválidos sin pasar por API', async () => {
  await assert.rejects(pool.query('INSERT INTO "Mascotas" (nombre,raza,color,collar_gps) VALUES ($1,$2,$3,$4)', ['Otra','R','C','CO-458']), {code:'23505',constraint:'uq_mascotas_collar_gps'});
  await assert.rejects(pool.query('INSERT INTO "Mascotas" (nombre,raza,color,collar_gps) VALUES ($1,$2,$3,$4)', ['Otra','R','C','co-458']), {code:'23514'});
});
test('registros concurrentes con foto y mismo GPS conservan solo un archivo', async () => {
  const valid=await sharp({create:{width:2,height:2,channels:3,background:'blue'}}).png().toBuffer();
  const rs=await Promise.all(Array.from({length:4},()=>photo(valid,'foto.png','image/png',{collar_gps:'PHOTO-RACE'})));
  assert.equal(rs.filter(r=>r.status===201).length,1); assert.equal(rs.filter(r=>r.status===409).length,3);
  assert.equal((await readdir(uploadDir)).length,1);
  const winner=await rs.find(r=>r.status===201)!.json();
  await req('DELETE','/'+winner.id); assert.equal((await readdir(uploadDir)).length,0);
});
test('DELETE elimina registro sin fotografia', async () => {
  const r = await req('DELETE',`/${id}`); assert.equal(r.status,204); assert.equal(await r.text(),'');
  assert.equal((await req('GET',`/${id}`)).status,404);
  assert.equal((await readdir(uploadDir)).length,0);
});
test('health, Swagger y contrato publicados', async () => {
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/api-docs/')).status,200);
  const spec=await (await fetch(base+'/openapi.json')).json(); assert.equal(spec.openapi,'3.0.3');
  const operations=Object.entries(spec.paths).filter(([path])=>path.startsWith('/api/mascotas')).flatMap(([,value])=>Object.keys(value as object).filter(k=>['get','post','put','patch','delete'].includes(k)));
  assert.equal(operations.length,4);
});
test('migraciones detienen booleanos y duplicados sin modificar datos', async () => {
  const sql = await readFile('database/migrations/002_integrity.sql','utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE "Mascotas" DROP CONSTRAINT uq_mascotas_collar_gps');
    await client.query('ALTER TABLE "Mascotas" DROP CONSTRAINT chk_mascotas_collar_gps_formato');
    await client.query('ALTER TABLE "Mascotas" ALTER COLUMN collar_gps TYPE BOOLEAN USING NULL');
    await assert.rejects(client.query(sql), /Migracion detenida/); await client.query('ROLLBACK');
    await client.query('BEGIN'); await client.query('ALTER TABLE "Mascotas" DROP CONSTRAINT uq_mascotas_collar_gps');
    await client.query('INSERT INTO "Mascotas" (nombre,raza,color,collar_gps) VALUES (\'A\',\'B\',\'C\',\'RACE-001\')');
    await assert.rejects(client.query(sql), /GPS duplicados/); await client.query('ROLLBACK');
  } finally { await client.query('ROLLBACK'); client.release(); }
});
test('coordenadas JSON persisten y aparecen en consulta y lista', async () => {
  const coordenadas={latitud:6.2442,longitud:-75.5812};
  const r=await req('POST','',{...pet,collar_gps:null,coordenadas}); assert.equal(r.status,201);
  const body=await r.json(); assert.deepEqual(body.coordenadas,coordenadas);
  assert.deepEqual((await (await req('GET','/'+body.id)).json()).coordenadas,coordenadas);
  const rows=await (await req('GET')).json(); assert.deepEqual(rows.find((p:{id:number})=>p.id===body.id).coordenadas,coordenadas);
  assert.deepEqual((await pool.query('SELECT coordenadas FROM "Mascotas" WHERE id=$1',[body.id])).rows[0].coordenadas,coordenadas);
  await req('DELETE','/'+body.id);
});
test('coordenadas multipart con foto en el mismo registro', async () => {
  const image=await sharp({create:{width:2,height:2,channels:3,background:'blue'}}).png().toBuffer();
  const r=await photo(image,'foto.png','image/png',{coordenadas:'{"latitud":0,"longitud":0}'}); assert.equal(r.status,201);
  const body=await r.json(); assert.deepEqual(body.coordenadas,{latitud:0,longitud:0}); assert.ok(body.foto);
  await req('DELETE','/'+body.id);
  assert.equal((await photo(image,'foto.png','image/png',{coordenadas:'no-json'})).status,400);
  assert.equal((await readdir(uploadDir)).length,0);
});
test('coordenadas opcionales, limites y rechazo API y SQL', async () => {
  for (const coordenadas of [null,{latitud:-90,longitud:-180},{latitud:90,longitud:180}]) {
    const r=await req('POST','',{...pet,collar_gps:null,coordenadas}); assert.equal(r.status,201);
    const body=await r.json(); assert.deepEqual(body.coordenadas,coordenadas); await req('DELETE','/'+body.id);
  }
  const r=await req('POST','',{...pet,collar_gps:null}); const body=await r.json(); assert.equal(body.coordenadas,null); await req('DELETE','/'+body.id);
  for (const coordenadas of [{latitud:91,longitud:0},{latitud:0,longitud:-181},{latitud:1},{latitud:'1',longitud:2},{latitud:null,longitud:2},{latitud:0,longitud:0,extra:1},[],{},'6,-75']) {
    assert.equal((await req('POST','',{...pet,collar_gps:null,coordenadas})).status,400);
    await assert.rejects(pool.query('INSERT INTO "Mascotas" (nombre,raza,color,coordenadas) VALUES ($1,$2,$3,$4::jsonb)', ['Test','R','C',JSON.stringify(coordenadas)]),{code:'23514',constraint:'chk_mascotas_coordenadas'});
  }
});
test('health devuelve 503 si PostgreSQL deja de estar disponible', async () => {
  await pool.end();
  assert.equal((await fetch(base+'/health')).status,503);
  // Pool.end no es idempotente; el teardown conserva una instancia ya cerrada sin repetir end.
  pool = undefined as unknown as pg.Pool;
});
