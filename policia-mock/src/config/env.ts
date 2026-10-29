import 'dotenv/config';
import { z } from 'zod';
import path from 'node:path';
export const env = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().default('postgres'), DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).default('ProteccionAnimal'),
  DB_USER: z.string().min(1), DB_PASSWORD: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_PHOTO_SIZE_MB: z.coerce.number().positive().max(5).default(5),
  MAX_EVIDENCE_SIZE_MB: z.coerce.number().positive().max(20).default(20),
  MAX_EVIDENCES_PER_DENUNCIA: z.coerce.number().int().min(1).max(5).default(5)
}).parse(process.env);
export const uploadDir = path.resolve(env.UPLOAD_DIR);
