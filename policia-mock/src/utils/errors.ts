export class ApiError extends Error {
  constructor(public status: number, public codigo: string, mensaje: string) { super(mensaje); }
}
export const notFound = (id: string) => new ApiError(404, 'DENUNCIA_NO_ENCONTRADA', `No se encontró la denuncia con ID ${id}.`);
