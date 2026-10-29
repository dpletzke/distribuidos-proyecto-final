import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().default('postgres'), DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string().default('PetAlert'), DB_USER: z.string().min(1), DB_PASSWORD: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().max(5).default(5)
});
export const env = schema.parse(process.env);
export const uploadDir = path.resolve(env.UPLOAD_DIR);
