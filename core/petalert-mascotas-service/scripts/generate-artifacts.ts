import { mkdir, writeFile } from 'node:fs/promises';
import { openapi } from '../src/config/swagger.js';
await mkdir('postman', { recursive: true });
await mkdir('../../contracts', { recursive: true });
const write = (p: string, data: unknown) => writeFile(p, JSON.stringify(data, null, 2) + '\n');
await write('../../contracts/petalert.openapi.json', openapi);
const pet = { nombre:'Max',raza:'Labrador',color:'Dorado',collar_gps:'{{gpsCode}}',foto:null,coordenadas:{latitud:6.2442,longitud:-75.5812} };
const example = {...pet,collar_gps:'CO-458',id:1,created_at:'2026-10-29T15:00:00.000Z',updated_at:'2026-10-29T15:00:00.000Z'};
function item(name: string, method: string, route: string, status: number, script: string[] = [], response: unknown = example) {
  const request = { method, header: [], url: '{{baseUrl}}' + route };
  const checks = status === 204 ? [] : [Array.isArray(response)
    ? "pm.test('Lista', () => pm.expect(pm.response.json()).to.be.an('array'));"
    : "pm.test('Modelo mascota', () => { const p = pm.response.json(); ['id','nombre','raza','color','collar_gps','foto','coordenadas','created_at','updated_at'].forEach(k => pm.expect(p).to.have.property(k)); });"];
  return { name, request, event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
    "pm.test('HTTP " + status + "', () => pm.response.to.have.status(" + status + "));", ...checks, ...script
  ] } }], response: [{ name: 'Ejemplo ' + status, originalRequest: request,
    status: status === 201 ? 'Created' : status === 204 ? 'No Content' : 'OK', code: status,
    header: [{ key: 'Content-Type', value: 'application/json' }], body: status === 204 ? '' : JSON.stringify(response, null, 2)
  }] };
}
const create: any = item('Registrar mascota con foto opcional','POST','/api/mascotas',201,["if (pm.response.code === 201) pm.environment.set('mascotaId', pm.response.json().id);"]);
create.request.body = { mode: 'formdata', formdata: [
  { key: 'nombre', value: 'Max', type: 'text' },
  { key: 'raza', value: 'Labrador', type: 'text' },
  { key: 'color', value: 'Dorado', type: 'text' },
  { key: 'collar_gps', value: '{{gpsCode}}', type: 'text' },
  { key: 'coordenadas', value: '{"latitud":6.2442,"longitud":-75.5812}', type: 'text', description: 'Opcional: desactivar si no conoce la ubicacion.' },
  { key: 'foto', type: 'file', src: null, disabled: true, description: 'Opcional: activar y seleccionar JPG/PNG/WEBP de hasta 5 MB.' }
] };
create.response[0].originalRequest = create.request;
create.event.unshift({listen:'prerequest',script:{type:'text/javascript',exec:["pm.environment.set('gpsCode', 'PM-' + pm.variables.replaceIn('{{$guid}}').toUpperCase());"]}});
const list = item('Listar mascotas','GET','/api/mascotas',200,[],[example]);
const collection = { info: {
  name:'PetAlert', description:'Cuatro operaciones. Registro multipart con foto opcional en la misma solicitud. Activar el campo foto y seleccionar archivo; omitir collar_gps si no hay GPS. Ejecutar en orden.',
  schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
}, item: [create, item('Consultar por ID','GET','/api/mascotas/{{mascotaId}}',200), list, item('Eliminar mascota','DELETE','/api/mascotas/{{mascotaId}}',204)] };
await write('postman/PetAlert.postman_collection.json',collection);
await write('postman/PetAlert.postman_environment.json',{name:'PetAlert local',values:[{key:'baseUrl',value:'http://localhost:3000',enabled:true},{key:'mascotaId',value:'1',enabled:true},{key:'gpsCode',value:'CO-458',enabled:true}],_postman_variable_scope:'environment'});
