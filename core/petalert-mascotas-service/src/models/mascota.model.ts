export interface MascotaInput {
  coordenadas: { latitud: number; longitud: number } | null;
  nombre: string; raza: string; color: string; collar_gps: string | null; foto: string | null;
}
export interface Mascota extends MascotaInput {
  id: string | number; created_at: Date; updated_at: Date;
}
