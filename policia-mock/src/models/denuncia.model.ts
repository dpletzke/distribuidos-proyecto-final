export interface DenunciaInput {
  nombre: string | null; raza: string | null; color: string | null; collar_gps: string | null;
  nombre_denunciante: string; telefono: string | null; correo: string | null;
  descripcion_denuncia: string; tipo_denuncia: 1 | 2;
}
export const publicId = (id: string | number) => BigInt(id) <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(id) : String(id);
