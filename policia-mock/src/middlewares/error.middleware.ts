import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
export const errorHandler: ErrorRequestHandler = (err,_req,res,_next) => {
  let status=500, codigo='ERROR_INTERNO', mensaje='No se pudo completar la operación.';
  if (err instanceof ApiError) { status=err.status; codigo=err.codigo; mensaje=err.message; }
  else if (err instanceof ZodError) {
    status=400; const tipo=err.issues.some(i=>i.path[0]==='tipo_denuncia');
    codigo=tipo?'TIPO_DENUNCIA_INVALIDO':'DATOS_INVALIDOS';
    mensaje=tipo?'El tipo de denuncia debe ser 1 (Pérdida) o 2 (Maltrato).':err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');
  } else if (err instanceof multer.MulterError) {
    status=err.code==='LIMIT_FILE_SIZE'?413:400; codigo='CARGA_INVALIDA'; mensaje='Revise los campos datos, foto y evidencias y los límites de carga.';
  } else if (err?.type==='entity.parse.failed') {status=400;codigo='JSON_INVALIDO';mensaje='JSON inválido.';}
  else if (err?.type==='entity.too.large') {status=413;codigo='CUERPO_DEMASIADO_GRANDE';mensaje='Solicitud demasiado grande.';}
  else if (['23503','23505','23514'].includes(err?.code)) {status=409;codigo='CONFLICTO_INTEGRIDAD';mensaje='La operación viola una restricción de integridad.';}
  else if (['ECONNREFUSED','ECONNRESET','ETIMEDOUT','57P01','57P02','57P03','53300'].includes(err?.code) || String(err?.code).startsWith('08') || /connection timeout|Connection terminated|timeout exceeded when trying to connect/i.test(err?.message??'')) {status=503;codigo='BASE_DATOS_NO_DISPONIBLE';mensaje='PostgreSQL no está disponible.';}
  if (status===500) logger.error('Error interno de solicitud');
  res.status(status).json({codigo,mensaje});
};
