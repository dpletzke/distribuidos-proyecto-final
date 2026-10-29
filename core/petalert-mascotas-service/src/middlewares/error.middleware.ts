import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) { res.status(err.status).json({ codigo: err.codigo, mensaje: err.message }); return; }
  if (err instanceof ZodError) { res.status(400).json({ codigo: 'DATOS_INVALIDOS', mensaje: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }); return; }
  if (err instanceof multer.MulterError) {
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ codigo: err.code === 'LIMIT_FILE_SIZE' ? 'FOTO_DEMASIADO_GRANDE' : 'CARGA_INVALIDA', mensaje: 'Carga inválida: un archivo foto de hasta 5 MB.' }); return;
  }
  if (err?.type === 'entity.too.large') { res.status(413).json({ codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'Solicitud demasiado grande.' }); return; }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ codigo: 'JSON_INVALIDO', mensaje: 'JSON inválido.' }); return; }
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03', '53300'].includes(err?.code) || String(err?.code).startsWith('08')) {
    res.status(503).json({ codigo: 'BASE_DATOS_NO_DISPONIBLE', mensaje: 'Base de datos no disponible.' }); return;
  }
  logger.error('Error interno de solicitud');
  res.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'No se pudo completar la operación.' });
};
