import { z } from 'zod';
const text = z.string().trim().min(1).max(100);
const gps = z.string().trim().toUpperCase().min(1).max(50).regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/).nullable();
// Las rutas locales son propiedad del endpoint multipart, no se pueden compartir entre mascotas.
const foto = z.url({ protocol: /^https?$/ }).max(2048).nullable();
const coordenadasSchema = z.object({
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180)
}).strict();
export const createSchema = z.object({ nombre: text, raza: text, color: text, collar_gps: gps.optional().default(null), foto: foto.optional().default(null), coordenadas: coordenadasSchema.nullable().optional().default(null) }).strict();
export const idSchema = z.string().regex(/^[1-9][0-9]*$/).refine(v => /^[1-9][0-9]*$/.test(v) && v.length <= 19 && BigInt(v) <= 9223372036854775807n, 'ID fuera de rango.');
