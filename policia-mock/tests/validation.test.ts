import {test} from 'node:test';
import assert from 'node:assert/strict';
import {denunciaSchema,filtersSchema,idSchema} from '../src/validators/denuncias.validator.js';
const data={nombre_denunciante:'Ana',correo:'ana@example.com',descripcion_denuncia:'Animal perdido',tipo_denuncia:1};
test('obligatorios, contacto, GPS y tipo',()=>{
  assert.equal(denunciaSchema.parse({...data,collar_gps:' co-458 '}).collar_gps,'CO-458');
  for(const patch of [{correo:null},{correo:'invalido'},{telefono:'abc'},{tipo_denuncia:3},{tipo_denuncia:'1'},{nombre_denunciante:' '},{descripcion_denuncia:''},{foto:'../a.png'},{collar_gps:true}])assert.equal(denunciaSchema.safeParse({...data,...patch}).success,false);
});
test('ID BIGINT y filtros estrictos',()=>{
  for(const id of ['0','-1','1.5','9223372036854775808','1 OR 1=1'])assert.equal(idSchema.safeParse(id).success,false);
  for(const query of [{limit:'101'},{page:'0'},{tipo_denuncia:'3'},{fecha_desde:'2026-99-99'},{fecha_desde:'2026-10-30T00:00:00Z',fecha_hasta:'2026-10-29T00:00:00Z'}])assert.equal(filtersSchema.safeParse(query).success,false);
});
