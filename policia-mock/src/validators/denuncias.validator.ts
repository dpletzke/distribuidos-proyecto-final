import { z } from 'zod';
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional().default(null);
export const denunciaSchema = z.object({
  nombre: optionalText(100), raza: optionalText(100), color: optionalText(100),
  collar_gps: z.string().trim().toUpperCase().min(1).max(50).regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/).nullable().optional().default(null),
  nombre_denunciante: z.string().trim().min(1).max(150),
  telefono: z.string().trim().min(7).max(30).regex(/^\+?[0-9 ()-]+$/).refine(s => s.replace(/\D/g, '').length >= 7, 'Teléfono inválido.').nullable().optional().default(null),
  correo: z.email().max(150).nullable().optional().default(null),
  descripcion_denuncia: z.string().trim().min(1).max(10000),
  tipo_denuncia: z.union([z.literal(1), z.literal(2)])
}).strict().refine(d => d.telefono !== null || d.correo !== null, 'Proporcione teléfono o correo.');
export const idSchema = z.string().regex(/^[1-9][0-9]*$/).refine(v => /^[1-9][0-9]*$/.test(v) && v.length <= 19 && BigInt(v) <= 9223372036854775807n, 'ID fuera de rango.');
const date = z.iso.datetime({ offset: true });
export const filtersSchema = z.object({
  tipo_denuncia: z.enum(['1','2']).transform(Number).optional(), nombre: z.string().trim().min(1).max(100).optional(),
  collar_gps: z.string().trim().toUpperCase().min(1).max(50).regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/).optional(),
  fecha_desde: date.optional(), fecha_hasta: date.optional(),
  page: z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().max(1000000)).optional().default(1),
  limit: z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().max(100)).optional().default(10)
}).strict().refine(d => !d.fecha_desde || !d.fecha_hasta || Date.parse(d.fecha_desde) <= Date.parse(d.fecha_hasta), 'Intervalo de fechas inválido.');
export type Filters = z.infer<typeof filtersSchema>;
