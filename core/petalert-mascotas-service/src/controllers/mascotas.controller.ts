import type { RequestHandler } from 'express';
import { service } from '../services/mascotas.service.js';
import { createSchema, idSchema } from '../validators/mascotas.validator.js';
import { ApiError } from '../utils/errors.js';
export const create: RequestHandler = async (req, res) => {
  if (req.is('multipart/form-data') && typeof req.body?.coordenadas === 'string') {
    try { req.body.coordenadas = JSON.parse(req.body.coordenadas); }
    catch { throw new ApiError(400, 'DATOS_INVALIDOS', 'coordenadas debe contener JSON valido con latitud y longitud.'); }
  }
  if (req.file && req.body?.foto !== undefined) throw new ApiError(400, 'FOTO_AMBIGUA', 'Envie una foto como archivo o URL, no ambos.');
  const pet = await service.create(createSchema.parse(req.body), req.file);
  res.location('/api/mascotas/' + pet.id).status(201).json(pet);
};
export const list: RequestHandler = async (_req, res) => { res.json(await service.list()); };
export const get: RequestHandler = async (req, res) => { res.json(await service.get(idSchema.parse(req.params.id))); };
export const remove: RequestHandler = async (req, res) => { await service.remove(idSchema.parse(req.params.id)); res.status(204).end(); };
