export class ApiError extends Error {
  constructor(public status: number, public codigo: string, mensaje: string) { super(mensaje); }
}
export const duplicate = (gps: string) => new ApiError(409, 'GPS_DUPLICADO',
  `El código del collar GPS ${gps} ya se encuentra registrado en otra mascota.`);
export const notFound = () => new ApiError(404, 'MASCOTA_NO_ENCONTRADA', 'La mascota no existe.');
