import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import type {Server} from 'node:http';
import pg from 'pg';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import YAML from 'yaml';
const db='proteccion_test_'+randomUUID().replaceAll('-','');
const admin=new pg.Pool({host:process.env.DB_HOST??'localhost',port:Number(process.env.DB_PORT??5433),user:process.env.DB_USER??'petalert_user',password:process.env.DB_PASSWORD,database:'postgres',connectionTimeoutMillis:3000});
let pool:pg.Pool,server:Server,base:string,dir:string,created=false,png:Buffer,pdf:Buffer,mp4:Buffer,id:number,filesId:number;
const data={nombre:'Max',raza:'Labrador',color:'Dorado',collar_gps:'CO-458',nombre_denunciante:'Ana Test',telefono:'3001234567',correo:'ana@example.com',descripcion_denuncia:'Mascota perdida cerca del parque',tipo_denuncia:1};
const req=(method:string,suffix='',body?:unknown)=>fetch(base+'/api/denuncias'+suffix,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
async function multi(method:string,suffix:string,body:unknown,files:{field:string;buffer:Buffer;mime:string;name:string}[]){const form=new FormData();form.append('datos',typeof body==='string'?body:JSON.stringify(body));for(const f of files)form.append(f.field,new Blob([new Uint8Array(f.buffer)],{type:f.mime}),f.name);return fetch(base+'/api/denuncias'+suffix,{method,body:form});}
const img=(field='foto')=>({field,buffer:png,mime:'image/png',name:'animal.png'});
const doc=()=>({field:'evidencias',buffer:pdf,mime:'application/pdf',name:'informe.pdf'});
async function storedFiles(){return (await readdir(dir,{recursive:true,withFileTypes:true})).filter(e=>e.isFile()).length;}
before(async()=>{
  assert.match(db,/^proteccion_test_[a-f0-9]{32}$/);await admin.query(`CREATE DATABASE "${db}"`);created=true;
  dir=await mkdtemp(path.join(tmpdir(),'proteccion-test-'));
  process.env.DB_HOST??='localhost';process.env.DB_PORT??='5433';process.env.DB_USER??='petalert_user';process.env.DB_NAME=db;process.env.UPLOAD_DIR=dir;
  pool=(await import('../src/config/database.js')).pool;await(await import('../src/config/migrate.js')).migrate();
  const {app}=await import('../src/app.js');server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');base=`http://127.0.0.1:${a.port}`;
  png=await sharp({create:{width:3,height:3,channels:3,background:'blue'}}).png().toBuffer();
  const document=await PDFDocument.create();document.addPage();pdf=Buffer.from(await document.save());
  const temp=await mkdtemp(path.join(tmpdir(),'proteccion-video-'));
  try{const f=path.join(temp,'v.mp4');execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','color=c=blue:s=16x16:d=0.2','-c:v','mpeg4','-y',f],{windowsHide:true});mp4=await readFile(f);}finally{await rm(temp,{recursive:true,force:true});}
});
after(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));if(pool)await pool.end();if(created)await admin.query(`DROP DATABASE "${db}"`);await admin.end();if(dir)await rm(dir,{recursive:true,force:true});});
test('Perdida y Maltrato sin archivos; ID real y GPS repetible',async()=>{
  for(const tipo_denuncia of [1,2]){
    const r=await req('POST','',{...data,tipo_denuncia});assert.equal(r.status,201);const b=await r.json();id=b.id_denuncia;
    assert.ok(b.mensaje.includes(String(id)));assert.equal(b.data.tipo_denuncia_descripcion,tipo_denuncia===1?'Pérdida':'Maltrato');
    assert.equal((await pool.query('SELECT tipo_denuncia FROM "Denuncias" WHERE id=$1',[id])).rows[0].tipo_denuncia,tipo_denuncia);
  }
});
test('POST con foto, imagen, PDF y MP4 reales en la misma solicitud',async()=>{
  const r=await multi('POST','',data,[img(),img('evidencias'),doc(),{field:'evidencias',buffer:mp4,mime:'video/mp4',name:'video.mp4'}]);assert.equal(r.status,201);
  const b=await r.json();filesId=b.id_denuncia;assert.equal(b.data.evidencias.length,3);assert.ok(!b.data.foto.startsWith('/app'));
  for(const e of b.data.evidencias){assert.equal(e.denuncia_id,filesId);await access(path.join(dir,e.ruta_archivo));}
  await access(path.join(dir,b.data.foto));assert.equal(await storedFiles(),4);
});
test('GET existente, inexistente e ID invalido',async()=>{
  const r=await req('GET','/'+filesId);assert.equal(r.status,200);assert.equal((await r.json()).data.evidencias.length,3);
  assert.equal((await req('GET','/9223372036854775807')).status,404);assert.equal((await req('GET','/abc')).status,400);
});
test('lista, total antes de paginar, filtros y pagina vacia',async()=>{
  const all=await(await req('GET','?page=1&limit=1')).json();assert.equal(all.total,3);assert.equal(all.data.length,1);assert.equal(all.data[0].id,filesId);
  const loss=await(await req('GET','?tipo_denuncia=1&nombre=ma&collar_gps=co-458')).json();assert.equal(loss.total,2);
  const empty=await(await req('GET','?page=99&limit=1')).json();assert.equal(empty.total,3);assert.deepEqual(empty.data,[]);
  assert.equal((await(await req('GET','?fecha_desde=2099-01-01T00:00:00Z')).json()).total,0);
  assert.equal((await(await req('GET','?fecha_hasta=2000-01-01T00:00:00Z')).json()).total,0);
  assert.equal((await(await req('GET',"?nombre="+encodeURIComponent("' OR 1=1 --"))).json()).total,0);
  assert.equal((await req('GET','?limit=101')).status,400);
});
test('PUT exige obligatorios, conserva archivos y limpia opcionales omitidos',async()=>{
  const old=(await(await req('GET','/'+filesId)).json()).data;
  const r=await req('PUT','/'+filesId,{nombre_denunciante:'Actualizado',correo:'nuevo@example.com',descripcion_denuncia:'Vista en el parque',tipo_denuncia:2});assert.equal(r.status,200);
  const now=(await(await req('GET','/'+filesId)).json()).data;assert.equal(now.nombre,null);assert.equal(now.foto,old.foto);assert.deepEqual(now.evidencias,old.evidencias);assert.ok(Date.parse(now.updated_at)>Date.parse(old.updated_at));
  assert.equal((await req('PUT','/'+filesId,{tipo_denuncia:1})).status,400);
  assert.equal((await req('PUT','/9223372036854775807',data)).status,404);
});
test('PUT reemplaza foto y agrega evidencias sin borrar anteriores',async()=>{
  const old=(await(await req('GET','/'+filesId)).json()).data;
  const r=await multi('PUT','/'+filesId,data,[img(),doc()]);assert.equal(r.status,200);
  const now=(await(await req('GET','/'+filesId)).json()).data;assert.notEqual(now.foto,old.foto);assert.equal(now.evidencias.length,4);
  await assert.rejects(access(path.join(dir,old.foto)));await access(path.join(dir,now.foto));
  for(const e of old.evidencias)await access(path.join(dir,e.ruta_archivo));assert.equal(await storedFiles(),5);
});
test('limite acumulado de evidencias protegido ante PUT concurrentes',async()=>{
  const rs=await Promise.all([multi('PUT','/'+filesId,data,[doc()]),multi('PUT','/'+filesId,data,[doc()])]);
  assert.deepEqual(rs.map(r=>r.status).sort(),[200,400]);assert.equal((await(await req('GET','/'+filesId)).json()).data.evidencias.length,5);assert.equal(await storedFiles(),6);
});
test('validacion de obligatorios, contacto, tipo y JSON multipart',async()=>{
  for(const patch of [{nombre_denunciante:''},{descripcion_denuncia:' '},{correo:'mal'},{telefono:null,correo:null}])assert.equal((await req('POST','',{...data,...patch})).status,400);
  const bad=await req('POST','',{...data,tipo_denuncia:3});assert.equal(bad.status,400);assert.equal((await bad.json()).codigo,'TIPO_DENUNCIA_INVALIDO');
  assert.equal((await multi('POST','','{',[img()])).status,400);
});
test('archivos falsos, extension/MIME, exceso de cantidad y tamano',async()=>{
  const count=await storedFiles();
  for(const file of [{...img(),buffer:Buffer.from('fake')},{...doc(),buffer:Buffer.from('%PDF-fake')},{field:'evidencias',buffer:Buffer.from('0000ftypfake'),mime:'video/mp4',name:'a.mp4'},{...img(),name:'a.txt'},{...doc(),field:'foto'}])assert.equal((await multi('POST','',data,[file])).status,415);
  assert.equal((await multi('POST','',data,[{...img(),buffer:Buffer.alloc(5*1024*1024+1)}])).status,413);
  assert.equal((await multi('POST','',data,[{...doc(),buffer:Buffer.alloc(20*1024*1024+1)}])).status,413);
  assert.equal((await multi('POST','',data,Array.from({length:6},doc))).status,400);
  assert.equal(await storedFiles(),count);
});
test('fallo SQL al guardar evidencia revierte registro y elimina todos sus archivos',async()=>{
  const count=await storedFiles();const rows=(await pool.query('SELECT count(*) FROM "Denuncias"')).rows[0].count;
  await pool.query("CREATE FUNCTION fail_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
  await pool.query('CREATE TRIGGER fail_test BEFORE INSERT ON "DenunciaEvidencias" FOR EACH ROW EXECUTE FUNCTION fail_test()');
  try{assert.equal((await multi('POST','',data,[img(),doc()])).status,500);assert.equal(await storedFiles(),count);assert.equal((await pool.query('SELECT count(*) FROM "Denuncias"')).rows[0].count,rows);assert.equal((await pool.query('SELECT count(*) FROM file_cleanup')).rows[0].count,'0');}
  finally{await pool.query('DROP TRIGGER fail_test ON "DenunciaEvidencias"');await pool.query('DROP FUNCTION fail_test()');}
});
test('PostgreSQL rechaza tipos/contactos invalidos y sexto archivo',async()=>{
  await assert.rejects(pool.query('INSERT INTO "Denuncias" (nombre_denunciante,correo,descripcion_denuncia,tipo_denuncia) VALUES ($1,$2,$3,$4)',['A','a@example.com','B',3]),{code:'23514'});
  await assert.rejects(pool.query('INSERT INTO "Denuncias" (nombre_denunciante,descripcion_denuncia,tipo_denuncia) VALUES ($1,$2,$3)',['A','B',1]),{code:'23514'});
  await assert.rejects(pool.query('INSERT INTO "DenunciaEvidencias" (denuncia_id,nombre_archivo,ruta_archivo,tipo_archivo,tamano_bytes) VALUES ($1,$2,$3,$4,$5)',[filesId,'a.pdf','other.pdf','application/pdf',10]),{code:'23514',constraint:'chk_max_evidencias'});
});
test('solo cuatro endpoints; sin salud, docs, descarga, DELETE o PATCH',async()=>{
  for(const p of ['/health','/api-docs','/uploads/a.png'])assert.equal((await fetch(base+p)).status,404);
  for(const method of ['DELETE','PATCH'])assert.equal((await req(method,'/'+id,data)).status,404);
  const spec=YAML.parse(await readFile('docs/openapi.yaml','utf8'));assert.equal(Object.values(spec.paths).flatMap((v:any)=>Object.keys(v).filter(k=>['get','post','put','delete','patch'].includes(k))).length,4);
  const collection=JSON.parse(await readFile('postman/ProteccionAnimal.postman_collection.json','utf8'));assert.equal(collection.item.length,4);
});
