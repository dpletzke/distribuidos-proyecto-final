import type { Request, RequestHandler } from 'express';
import { denunciaSchema, filtersSchema, idSchema } from '../validators/denuncias.validator.js';
import { service } from '../services/denuncias.service.js';
import { ApiError } from '../utils/errors.js';
function input(req:Request) {
  let data=req.body;
  if(req.is('multipart/form-data')) {
    if(!data||Object.keys(data).some(k=>k!=='datos')||typeof data.datos!=='string') throw new ApiError(400,'DATOS_INVALIDOS','Envíe el campo datos como texto JSON.');
    try{data=JSON.parse(data.datos);}catch{throw new ApiError(400,'JSON_INVALIDO','El campo datos contiene JSON inválido.');}
  } else if(!req.is('application/json')) throw new ApiError(415,'CONTENIDO_NO_SOPORTADO','Utilice application/json o multipart/form-data.');
  return denunciaSchema.parse(data);
}
const files=(req:Request)=>Object.values((req.files??{}) as Record<string,Express.Multer.File[]>).flat();
export const create:RequestHandler=async(req,res)=>{
  const data=await service.save(input(req),files(req));
  res.location(`/api/denuncias/${data.id}`).status(201).json({codigo:'DENUNCIA_CREADA',mensaje:`La denuncia fue creada exitosamente con el ID ${data.id}.`,id_denuncia:data.id,data});
};
export const update:RequestHandler=async(req,res)=>{
  const data=await service.save(input(req),files(req),idSchema.parse(req.params.id));
  res.json({codigo:'DENUNCIA_ACTUALIZADA',mensaje:`La denuncia con ID ${data.id} fue actualizada exitosamente.`,id_denuncia:data.id});
};
export const get:RequestHandler=async(req,res)=>{res.json({codigo:'CONSULTA_EXITOSA',mensaje:'La denuncia fue consultada correctamente.',data:await service.get(idSchema.parse(req.params.id))});};
export const list:RequestHandler=async(req,res)=>{res.json({codigo:'CONSULTA_EXITOSA',mensaje:'Las denuncias fueron consultadas correctamente.',...await service.list(filtersSchema.parse(req.query))});};
