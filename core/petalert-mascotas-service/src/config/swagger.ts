const coordenadas = {
  type: 'object', nullable: true, additionalProperties: false, required: ['latitud', 'longitud'],
  description: 'Ubicacion WGS84 en grados decimales; null si no se conoce.',
  properties: { latitud: { type: 'number', minimum: -90, maximum: 90 }, longitud: { type: 'number', minimum: -180, maximum: 180 } },
  example: { latitud: 6.2442, longitud: -75.5812 }
};
const inputProperties = {
  coordenadas,
  nombre: { type: 'string', minLength: 1, maxLength: 100, example: 'Max' },
  raza: { type: 'string', minLength: 1, maxLength: 100, example: 'Labrador' },
  color: { type: 'string', minLength: 1, maxLength: 100, example: 'Dorado' },
  collar_gps: { type: 'string', nullable: true, maxLength: 50, pattern: '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$', example: 'CO-458', description: 'Se recortan espacios externos y se convierte a mayúsculas. Único; múltiples NULL permitidos.' },
  foto: { type: 'string', nullable: true, format: 'uri', maxLength: 2048, example: null, description: 'URL HTTP/HTTPS externa o null. Para adjuntar archivo use multipart/form-data en el registro.' }
};
const error = { type: 'object', required: ['codigo', 'mensaje'], properties: { codigo: { type: 'string' }, mensaje: { type: 'string' } } };
const json = (schema: object, example?: object) => ({ 'application/json': { schema, ...(example ? { example } : {}) } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const errors = {
  '400': { description: 'Datos inválidos', content: json(error, { codigo: 'DATOS_INVALIDOS', mensaje: 'nombre: campo obligatorio' }) },
  '404': { description: 'Mascota o recurso no encontrado', content: json(error) },
  '409': { description: 'GPS ya asignado a otra mascota', content: json(error, { codigo: 'GPS_DUPLICADO', mensaje: 'El código del collar GPS CO-458 ya se encuentra registrado en otra mascota.' }) },
  '413': { description: 'Archivo mayor de 5 MB o JSON mayor de 64 KB', content: json(error) },
  '415': { description: 'Tipo de fotografía inválido', content: json(error) },
  '500': { description: 'Error interno', content: json(error) },
  '503': { description: 'Base de datos no disponible', content: json(error) }
};
const registrationBody = { required: true, content: {
  ...json(ref('MascotaCreate')),
  'multipart/form-data': { schema: { type: 'object', additionalProperties: false,
    required: ['nombre', 'raza', 'color'], properties: {
      coordenadas: { type: 'string', example: '{"latitud":6.2442,"longitud":-75.5812}', description: 'JSON como texto; opcional. Omitir o enviar null para ubicacion desconocida.' },
      nombre: inputProperties.nombre, raza: inputProperties.raza, color: inputProperties.color,
      collar_gps: { type: 'string', maxLength: 50, description: 'Opcional; omitir si no tiene GPS. No enviar vacio ni la cadena null.' },
      foto: { type: 'string', format: 'binary', description: 'Archivo opcional JPG/PNG/WEBP, maximo 5 MB.' }
    }
  } }
} };
const success = { description: 'Mascota con campos de auditoría', content: json(ref('Mascota')) };
export const openapi = {
  openapi: '3.0.3', info: { title: 'PetAlert Mascotas', version: '1.0.0', description: 'API local sin autenticación. Registro, consulta, listado y borrado persistentes, códigos GPS únicos y fotografías de hasta 5 MB.' },
  servers: [{ url: '/', description: 'Servidor actual' }],
  components: { schemas: {
    MascotaCreate: { type: 'object', additionalProperties: false, required: ['nombre', 'raza', 'color'], properties: inputProperties },
    Mascota: { type: 'object', required: ['id', ...Object.keys(inputProperties), 'created_at', 'updated_at'], properties: {
      ...inputProperties, foto: { type: 'string', nullable: true, example: '/uploads/mascota-uuid.png' },
      id: { oneOf: [{ type: 'integer', minimum: 1 }, { type: 'string', pattern: '^[1-9][0-9]*$' }], description: 'Número mientras sea seguro en JavaScript; cadena para BIGINT superior a 2^53-1.', example: 1 },
      created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' }
    } }, Error: error
  } },
  paths: {
    '/health': { get: { operationId: 'health', summary: 'Verificar conexión PostgreSQL', responses: {
      '200': { description: 'Disponible', content: json({ type: 'object', properties: { status: { type: 'string' }, service: { type: 'string' }, database: { type: 'string' } } }, { status: 'OK', service: 'petalert-mascotas-service', database: 'connected' }) }, '503': errors['503']
    } } },
    '/api/mascotas': {
      get: { operationId: 'listarMascotas', summary: 'Listar todas las mascotas por ID ascendente', responses: { '200': { description: 'Lista completa', content: json({ type: 'array', items: ref('Mascota') }) }, '500': errors['500'], '503': errors['503'] } },
      post: { operationId: 'crearMascota', summary: 'Registrar mascota', requestBody: registrationBody, responses: { '201': success, ...errors } }
    },
    '/api/mascotas/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[1-9][0-9]*$', example: '1' }, description: 'BIGINT positivo hasta 9223372036854775807' }],
      get: { operationId: 'consultarMascota', summary: 'Consultar por ID', responses: { '200': success, ...errors } },
      delete: { operationId: 'eliminarMascota', summary: 'Eliminar mascota y limpiar su foto local', responses: { '204': { description: 'Eliminada, sin cuerpo' }, ...errors } }
    }
  }
};
