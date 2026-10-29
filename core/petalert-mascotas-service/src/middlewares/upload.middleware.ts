import multer from 'multer';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { ApiError } from '../utils/errors.js';
const formats: Record<string, string[]> = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] };
const invalid = () => new ApiError(415, 'FOTO_INVALIDA', 'La foto debe ser JPG, PNG o WEBP con contenido válido.');
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1, fields: 6, parts: 7, fieldSize: 2048 },
  fileFilter: (_req, file, cb) => formats[file.mimetype]?.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(invalid())
}).single('foto');
export async function validateImage(file: Express.Multer.File) {
  try {
    const image = sharp(file.buffer, { failOn: 'warning', limitInputPixels: 25000000, animated: true });
    const meta = await image.metadata();
    if (!meta.format || `image/${meta.format === 'jpeg' ? 'jpeg' : meta.format}` !== file.mimetype || (meta.pages ?? 1) > 1) throw invalid();
    // Decodificar y recodificar elimina metadata y contenido ajeno al formato.
    return { buffer: await image.rotate().toBuffer(), extension: meta.format === 'jpeg' ? 'jpg' : meta.format };
  } catch { throw invalid(); }
}
