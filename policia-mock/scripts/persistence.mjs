import assert from 'node:assert/strict';
import {writeFile,readFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {pool} from '../dist/config/database.js';
import {diskPath,cleanFiles} from '../dist/services/files.service.js';
const stateFile='/tmp/proteccion-persistence.json';
const base='http://127.0.0.1:3000/api/denuncias';
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
try {
  if(process.argv[2]==='prepare') {
    const form=new FormData();form.append('datos',JSON.stringify({nombre:'Prueba persistencia',nombre_denunciante:'Prueba automatizada',correo:'test@example.com',descripcion_denuncia:'Registro temporal de verificacion',tipo_denuncia:1}));
    const image=await sharp({create:{width:2,height:2,channels:3,background:'blue'}}).png().toBuffer();
    const pdf=await PDFDocument.create();pdf.addPage();
    form.append('foto',new Blob([image],{type:'image/png'}),'foto.png');form.append('evidencias',new Blob([await pdf.save()],{type:'application/pdf'}),'informe.pdf');
    const r=await fetch(base,{method:'POST',body:form});assert.equal(r.status,201);const {data}=await r.json();
    const files=[data.foto,...data.evidencias.map(e=>e.ruta_archivo)];
    await writeFile(stateFile,JSON.stringify({data,files:await Promise.all(files.map(async ruta=>({ruta,sha256:hash(await readFile(diskPath(ruta)))})))}));
    console.log('Preparada denuncia temporal',data.id);
  } else if(process.argv[2]==='verify') {
    const {data,files}=JSON.parse(await readFile(stateFile,'utf8'));
    assert.match(String(data.id),/^[1-9][0-9]*$/);
    const r=await fetch(base+'/'+data.id);assert.equal(r.status,200);assert.deepEqual((await r.json()).data,data);
    for(const f of files)assert.equal(hash(await readFile(diskPath(f.ruta))),f.sha256);
    console.log('PASS: datos, IDs, auditoria, fotografia y evidencia persisten tras reiniciar.');
    // No existe DELETE HTTP. Limpieza administrativa exclusiva del registro propio verificado.
    const client=await pool.connect();
    try {await client.query('BEGIN');await client.query('DELETE FROM "DenunciaEvidencias" WHERE denuncia_id=$1',[data.id]);await client.query('DELETE FROM "Denuncias" WHERE id=$1',[data.id]);for(const f of files)await client.query('INSERT INTO file_cleanup(ruta) VALUES ($1) ON CONFLICT DO NOTHING',[f.ruta]);await client.query('COMMIT');}
    catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    await cleanFiles();await unlink(stateFile);
  } else throw new Error('Use prepare o verify');
} finally {await pool.end();}
