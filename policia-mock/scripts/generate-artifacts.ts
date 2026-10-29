import { mkdir,writeFile } from 'node:fs/promises';
import YAML from 'yaml';
const example={nombre:'Max',raza:'Labrador',color:'Dorado',collar_gps:'CO-458',nombre_denunciante:'Carlos Perez',telefono:'3001234567',correo:'carlos@example.com',descripcion_denuncia:'Mi mascota se perdio cerca del parque.',tipo_denuncia:1};
const text=(maxLength:number,nullable=false)=>({type:'string',minLength:1,maxLength,nullable});
const properties={nombre:text(100,true),raza:text(100,true),color:text(100,true),collar_gps:{...text(50,true),pattern:'^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$',description:'Se recorta y convierte a mayusculas. No es unico.'},nombre_denunciante:text(150),telefono:{...text(30,true),description:'Al menos 7 digitos; admite + al inicio, espacios, parentesis y guiones.'},correo:{...text(150,true),format:'email'},descripcion_denuncia:text(10000),tipo_denuncia:{type:'integer',enum:[1,2],description:'1: Perdida; 2: Maltrato'}};
const id={oneOf:[{type:'integer',minimum:1},{type:'string',pattern:'^[1-9][0-9]*$'}],description:'BIGINT: string cuando excede el entero seguro de JavaScript.'};
const evidence={type:'object',properties:{id,denuncia_id:id,nombre_archivo:{type:'string'},ruta_archivo:{type:'string',description:'Clave logica interna, NO URL de descarga.'},tipo_archivo:{type:'string'},tamano_bytes:{type:'integer'},created_at:{type:'string',format:'date-time'}}};
const complaint={type:'object',properties:{...properties,id,foto:{type:'string',nullable:true,description:'Clave interna; no es una URL publica.'},tipo_denuncia_descripcion:{type:'string',enum:['Pérdida','Maltrato']},evidencias:{type:'array',maxItems:5,items:evidence},created_at:{type:'string',format:'date-time'},updated_at:{type:'string',format:'date-time'}}};
const input={type:'object',additionalProperties:false,required:['nombre_denunciante','descripcion_denuncia','tipo_denuncia'],properties,anyOf:[{required:['telefono'],properties:{telefono:{type:'string',minLength:7}}},{required:['correo'],properties:{correo:{type:'string',format:'email'}}}],description:'Al menos telefono o correo no nulo. En PUT los opcionales omitidos pasan a null; los archivos se conservan.'};
const json=(schema:object,example?:unknown)=>({'application/json':{schema,...(example?{example}:{})}});
const body={required:true,content:{...json(input,example),'multipart/form-data':{schema:{type:'object',additionalProperties:false,required:['datos'],properties:{datos:{type:'string',example:JSON.stringify(example),description:'JSON serializado con el mismo esquema que application/json.'},foto:{type:'string',format:'binary',description:'JPG/PNG/WEBP, hasta 5 MB.'},evidencias:{type:'array',maxItems:5,items:{type:'string',format:'binary'},description:'Repetir evidencias. JPG/PNG/WEBP/PDF/MP4; 20 MB cada una, maximo 5 acumuladas por denuncia.'}}}}}};
const error={type:'object',required:['codigo','mensaje'],properties:{codigo:{type:'string'},mensaje:{type:'string'}}};
const errors=Object.fromEntries(Object.entries({'400':'Datos invalidos o limite de evidencias','404':'Denuncia no encontrada','409':'Conflicto de integridad','413':'Archivo demasiado grande','415':'Archivo o contenido no permitido','500':'Error interno','503':'PostgreSQL no disponible'}).map(([code,description])=>[code,{description,content:json(error)}]));
const result={type:'object',properties:{codigo:{type:'string'},mensaje:{type:'string'},id_denuncia:id,data:complaint}};
const parameter={name:'id',in:'path',required:true,schema:{type:'string',pattern:'^[1-9][0-9]*$'},description:'BIGINT positivo hasta 9223372036854775807'};
const spec={openapi:'3.0.3',info:{title:'ProteccionAnimal Denuncias',version:'1.0.0',description:'Exactamente cuatro operaciones. Uso local sin autenticacion. Archivos privados: solo metadatos, sin rutas de descarga.'},servers:[{url:'http://localhost:3001'}],components:{schemas:{DenunciaInput:input,Denuncia:complaint,Evidencia:evidence,Error:error}},paths:{
  '/api/denuncias':{
    post:{operationId:'crearDenuncia',summary:'Registrar datos, foto y evidencias en una transaccion',requestBody:body,responses:{'201':{description:'ID real generado por PostgreSQL',content:json(result)},...errors}},
    get:{operationId:'listarDenuncias',summary:'Listar por fecha descendente con filtros y paginacion',parameters:[
      {name:'tipo_denuncia',in:'query',schema:{type:'integer',enum:[1,2]}},
      {name:'nombre',in:'query',schema:{type:'string',maxLength:100},description:'Coincidencia parcial literal sin distinguir mayusculas.'},
      {name:'collar_gps',in:'query',schema:{type:'string',maxLength:50},description:'Coincidencia exacta normalizada.'},
      ...['fecha_desde','fecha_hasta'].map(name=>({name,in:'query',schema:{type:'string',format:'date-time'},description:'ISO 8601 con zona horaria; limite inclusivo.'})),
      {name:'page',in:'query',schema:{type:'integer',minimum:1,maximum:1000000,default:1}},
      {name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:10}}
    ],responses:{'200':{description:'Total antes de paginar; arreglo vacio si no hay resultados.',content:json({type:'object',properties:{codigo:{type:'string'},mensaje:{type:'string'},total:{type:'integer'},page:{type:'integer'},limit:{type:'integer'},data:{type:'array',items:complaint}}})},...errors}}
  },
  '/api/denuncias/{id}':{parameters:[parameter],
    get:{operationId:'consultarDenuncia',summary:'Consultar datos completos y metadatos',responses:{'200':{description:'Consulta exitosa',content:json(result)},...errors}},
    put:{operationId:'actualizarDenuncia',summary:'Actualizar datos, reemplazar foto o agregar evidencias',description:'Exige denunciante, descripcion, tipo y al menos un contacto. Opcionales omitidos pasan a null; archivos omitidos se conservan. Maximo 5 evidencias totales.',requestBody:body,responses:{'200':{description:'Actualizacion exitosa',content:json({type:'object',properties:{codigo:{type:'string'},mensaje:{type:'string'},id_denuncia:id}})},...errors}}
  }
}};
await mkdir('docs',{recursive:true});await mkdir('postman',{recursive:true});
await writeFile('docs/openapi.yaml',YAML.stringify(spec));
const sample={...example,id:125,foto:null,tipo_denuncia_descripcion:'Pérdida',evidencias:[],created_at:'2026-10-29T20:00:00.000Z',updated_at:'2026-10-29T20:00:00.000Z'};
const request=(method:string,url:string,multipart=false)=>({method,url:'{{baseUrl}}'+url,header:multipart||method==='GET'?[]:[{key:'Content-Type',value:'application/json'}],...(['POST','PUT'].includes(method)?{body:multipart?{mode:'formdata',formdata:[{key:'datos',type:'text',value:JSON.stringify(example,null,2)},{key:'foto',type:'file',src:null,disabled:true},{key:'evidencias',type:'file',src:null,disabled:true},{key:'evidencias',type:'file',src:null,disabled:true}]}:{mode:'raw',raw:JSON.stringify(example,null,2),options:{raw:{language:'json'}}}}:{})});
const make=(name:string,method:string,url:string,status:number,response:unknown)=>{
  const req=request(method,url,['POST','PUT'].includes(method));
  return {name,request:req,event:[{listen:'test',script:{type:'text/javascript',exec:[`pm.test('HTTP ${status}',()=>pm.response.to.have.status(${status}));`,`pm.test('Respuesta JSON',()=>{const b=pm.response.json();pm.expect(b).to.have.property('codigo');pm.expect(b).to.have.property('mensaje');});`,...(method==='POST'?["if(pm.response.code===201) pm.environment.set('denunciaId',pm.response.json().id_denuncia);"]:[])]}}],response:[{name:'Ejemplo multipart',originalRequest:req,status:status===201?'Created':'OK',code:status,header:[{key:'Content-Type',value:'application/json'}],body:JSON.stringify(response,null,2)},...(['POST','PUT'].includes(method)?[{name:'Ejemplo JSON sin archivos',originalRequest:request(method,url),status:status===201?'Created':'OK',code:status,header:[{key:'Content-Type',value:'application/json'}],body:JSON.stringify(response,null,2)}]:[])]};
};
await writeFile('postman/ProteccionAnimal.postman_collection.json',JSON.stringify({info:{name:'ProteccionAnimal',description:'Cuatro operaciones. POST/PUT usan datos JSON en form-data; activar foto/evidencias para adjuntar archivos. Ejemplos guardados muestran JSON alternativo. No hay eliminacion HTTP.',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item:[
  make('Crear denuncia','POST','/api/denuncias',201,{codigo:'DENUNCIA_CREADA',mensaje:'La denuncia fue creada exitosamente con el ID 125.',id_denuncia:125,data:sample}),
  make('Actualizar denuncia','PUT','/api/denuncias/{{denunciaId}}',200,{codigo:'DENUNCIA_ACTUALIZADA',mensaje:'La denuncia con ID 125 fue actualizada exitosamente.',id_denuncia:125}),
  make('Consultar denuncia','GET','/api/denuncias/{{denunciaId}}',200,{codigo:'CONSULTA_EXITOSA',mensaje:'La denuncia fue consultada correctamente.',data:sample}),
  make('Listar denuncias','GET','/api/denuncias?page=1&limit=10',200,{codigo:'CONSULTA_EXITOSA',mensaje:'Las denuncias fueron consultadas correctamente.',total:1,page:1,limit:10,data:[sample]})
]},null,2)+'\n');
await writeFile('postman/ProteccionAnimal.postman_environment.json',JSON.stringify({name:'ProteccionAnimal local',values:[{key:'baseUrl',value:'http://localhost:3001',enabled:true},{key:'denunciaId',value:'125',enabled:true}],_postman_variable_scope:'environment'},null,2)+'\n');
