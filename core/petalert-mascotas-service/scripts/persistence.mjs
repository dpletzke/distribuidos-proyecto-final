import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
const cwd = fileURLToPath(new URL('../../../', import.meta.url));
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const docker = (...args) => execFileSync('docker', ['compose', ...args], { cwd, stdio: 'inherit', windowsHide: true });
async function ready() {
  for (let i=0;i<60;i++) {
    try { if ((await fetch(base+'/health')).ok) return; } catch {}
    await delay(1000);
  }
  throw new Error('API no disponible tras reiniciar');
}
let id;
try {
  await ready();
  const bytes=await sharp({create:{width:3,height:3,channels:3,background:'blue'}}).png().toBuffer();
  const form=new FormData(); form.append('foto',new Blob([bytes],{type:'image/png'}),'persistencia.png');
  form.append('nombre','Prueba persistencia'); form.append('raza','Prueba'); form.append('color','Azul');
  const uploaded=await fetch(`${base}/api/mascotas`,{method:'POST',body:form}); assert.equal(uploaded.status,201);
  const pet=await uploaded.json(); id=pet.id; const photo=Buffer.from(await (await fetch(base+pet.foto)).arrayBuffer());
  docker('down'); docker('up','-d'); await ready();
  const restored=await fetch(`${base}/api/mascotas/${id}`); assert.equal(restored.status,200); assert.deepEqual(await restored.json(),pet);
  const image=await fetch(base+pet.foto); assert.equal(image.status,200); assert.deepEqual(Buffer.from(await image.arrayBuffer()),photo);
  console.log('PASS: registro, auditoría y bytes de fotografía sobreviven a down/up sin eliminar volúmenes.');
} finally {
  if (id) {
    await ready(); const r=await fetch(`${base}/api/mascotas/${id}`,{method:'DELETE'}); assert.equal(r.status,204);
  }
}
