# ProteccionAnimal — denuncias

Microservicio `proteccionanimal-denuncias-service` implementado en la carpeta existente `policia-mock`. Registra pérdida (1) y maltrato (2), con foto y evidencias en la misma solicitud. No implementa frontend ni simulaciones de datos.

## Inicio y conexión compartida

Si acaba de clonar o descargar el repositorio, complete primero la [guía de inicio](../README.md): cree el `.env` raíz desde `.env.example` y configure POSTGRES_PASSWORD y PGADMIN_PASSWORD. No necesita otro `.env` en esta carpeta para ejecutar Docker.

Desde la raíz del repositorio:

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f denuncias
```

Solo necesita Docker Desktop con contenedores Linux. El `docker-compose.yml` de esta carpeta delega al Compose raíz y carga su `.env`; también puede ejecutar `docker compose up -d --build` aquí. La conexión toma las credenciales que usted haya configurado en el `.env` raíz.

Los dos microservicios comparten PostgreSQL 16 y las credenciales `POSTGRES_USER`/`POSTGRES_PASSWORD` del `.env` raíz. El puerto externo `POSTGRES_PORT` es 5433 por defecto. La base de este servicio se llama exactamente `ProteccionAnimal`; mascotas usa `PetAlert`. En Docker, la conexión es `postgres:5432`. Al arrancar, el servicio crea la base si no existe y aplica migraciones antes de escuchar. El rol que inicializa Compose tiene los permisos necesarios; si configura uno restringido, necesita CREATEDB para la primera ejecución.

La API se publica en **http://localhost:3001**, configurable mediante `DENUNCIAS_PORT` en el `.env` raíz. Sus archivos persisten en el volumen independiente `petalert-mascotas_denuncias_uploads`. Los datos usan el volumen PostgreSQL existente.

```bash
docker compose restart denuncias
docker compose stop denuncias
docker compose up -d denuncias
docker compose exec denuncias npm test
```

No ejecute `down -v`: elimina volúmenes. El Compose de esta carpeta incluye el proyecto completo; `down` afecta también a los demás servicios, por lo que para detener solo denuncias use `stop denuncias` desde la raíz.

## Exactamente cuatro operaciones

| Método | Ruta | Resultado |
|---|---|---|
| POST | `/api/denuncias` | 201; mensaje con ID real, `id_denuncia` y `data` |
| PUT | `/api/denuncias/:id` | 200; confirmación e ID, o 404 |
| GET | `/api/denuncias/:id` | 200; datos completos y evidencias, o 404 |
| GET | `/api/denuncias` | 200; lista paginada, total y filtros |

No hay DELETE, PATCH, `/health`, `/api-docs`, rutas estáticas ni descargas. Docker usa una comprobación **interna TCP + SQL**. Las claves `foto` y `ruta_archivo` son rutas lógicas relativas al volumen, no URLs; la visualización/descarga requerirá un mecanismo autorizado en otra fase.

## Registrar y actualizar desde Postman

En Postman Desktop, seleccione **Import → Files** e importe la [colección](postman/ProteccionAnimal.postman_collection.json) y el [entorno](postman/ProteccionAnimal.postman_environment.json). Seleccione **ProteccionAnimal local** (`baseUrl=http://localhost:3001`). POST guarda automáticamente `denunciaId` para consultar o actualizar.

La colección contiene cuatro solicitudes. POST y PUT usan **Body → form-data**:

| Key | Type | Valor |
|---|---|---|
| datos | Text | JSON de abajo |
| foto | File | Foto opcional; active el campo y seleccione archivo |
| evidencias | File | Evidencia opcional |
| evidencias | File | Otra evidencia opcional; repetir la clave |

No configure Content-Type manualmente; Postman agrega el boundary. Los campos de archivo están deshabilitados inicialmente para permitir una primera prueba sin adjuntos. Los ejemplos guardados de POST y PUT también muestran la alternativa **raw → JSON** sin archivos.

```json
{
  "nombre": "Max",
  "raza": "Labrador",
  "color": "Dorado",
  "collar_gps": "CO-458",
  "nombre_denunciante": "Carlos Pérez",
  "telefono": "3001234567",
  "correo": "carlos@example.com",
  "descripcion_denuncia": "Mi mascota se perdió cerca del parque principal.",
  "tipo_denuncia": 1
}
```

Obligatorios: nombre del denunciante (hasta 150), descripción (hasta 10000), tipo numérico 1 o 2, y al menos teléfono o correo no nulo. Teléfono: 7 dígitos como mínimo, hasta 30 caracteres; admite + al inicio, espacios, guiones y paréntesis. Correo válido hasta 150. Datos del animal opcionales, hasta 100 caracteres. GPS opcional hasta 50, normalizado a mayúsculas, formato alfanumérico separado por guiones; **no es UNIQUE**. Las cadenas vacías son inválidas; use null u omita los opcionales.

PUT exige de nuevo todos los obligatorios y un contacto. **Los campos opcionales de datos omitidos pasan a null**, como reemplazo completo. Foto y evidencias existentes se conservan cuando no se adjuntan archivos. Una foto nueva reemplaza la anterior; evidencias nuevas se agregan, sin borrar las previas. El máximo acumulado es cinco evidencias por denuncia, incluso con PUT simultáneos.

IDs y fechas se generan en PostgreSQL; `updated_at` tiene trigger. Los BIGINT se devuelven como números seguros o cadenas si exceden la precisión de JavaScript. Todas las respuestas de error contienen `codigo` y `mensaje`: 400 validación, 404 no encontrado, 409 integridad, 413 tamaño, 415 formato, 500 interno, 503 PostgreSQL no disponible.

## Filtros y paginación

```text
GET /api/denuncias?tipo_denuncia=1&page=1&limit=10
GET /api/denuncias?nombre=max&collar_gps=CO-458
GET /api/denuncias?fecha_desde=2026-10-01T00:00:00Z&fecha_hasta=2026-10-31T23:59:59Z
```

`nombre`: coincidencia parcial literal sin distinguir mayúsculas. GPS: exacto normalizado. Fechas: ISO 8601 con zona horaria, límites inclusivos. `page`: 1 a 1000000; `limit`: 1 a 100, por defecto 10. Orden: `created_at DESC, id DESC`. `total` representa todos los registros filtrados antes de paginar, incluso cuando la página solicitada queda vacía. Conteo y resultados usan la misma instantánea de PostgreSQL.

## Archivos y consistencia

Foto: JPG/JPEG, PNG o WEBP estático, hasta 5 MB. Evidencias: esos formatos, PDF o MP4, hasta 20 MB cada una. Máximo cinco evidencias totales. Se validan extensión, MIME y contenido real: Sharp decodifica imágenes (máximo 25 millones de píxeles) y elimina metadatos; pdf-lib analiza documentos PDF no cifrados; ffprobe analiza MP4 y exige una pista de video válida. FFmpeg se instala dentro de Docker. Los nombres físicos son UUID; nombres originales se guardan solo como metadatos saneados.

Estructura: `/app/uploads/<id>/<uuid>.png` y `/app/uploads/<id>/evidencias/<uuid>.pdf`. No se guardan binarios en PostgreSQL ni se publican rutas físicas del host.

Datos y metadatos se guardan en una transacción. Una cola durable `file_cleanup`, confirmada antes de escribir archivos, permite limpiar un fallo o caída entre disco y COMMIT. La foto antigua se encola en la transacción de reemplazo. El recolector verifica referencias antes de borrar, y se ejecuta tras cada escritura, al arrancar y cada 60 segundos. Un bloqueo PostgreSQL coordina escritores y limpieza. Se usan conexiones independientes para la cola, evitando bloqueo por agotamiento del pool.

## pgAdmin web

Abra **http://localhost:5050** e ingrese con PGADMIN_EMAIL y PGADMIN_PASSWORD del `.env` raíz. Cuando el servidor solicite la contraseña de PostgreSQL, use POSTGRES_PASSWORD. En el servidor **PetAlert - PostgreSQL 16**, refresque **Databases** y seleccione **ProteccionAnimal**. Desde un pgAdmin instalado en Windows use localhost:5433, base ProteccionAnimal, usuario POSTGRES_USER y contraseña POSTGRES_PASSWORD.

En Query Tool de **ProteccionAnimal**:

```sql
SELECT * FROM "Denuncias" ORDER BY id DESC;
SELECT * FROM "DenunciaEvidencias" ORDER BY denuncia_id, id;
SELECT d.id, d.tipo_denuncia, d.nombre, count(e.id) AS evidencias
FROM "Denuncias" d LEFT JOIN "DenunciaEvidencias" e ON e.denuncia_id=d.id
GROUP BY d.id ORDER BY d.id DESC;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid='"Denuncias"'::regclass;
```

## Arquitectura y migraciones

`src/routes → controllers → services → repositories → PostgreSQL`. Validadores Zod, errores centralizados, Helmet, CORS, SQL parametrizado, pool y cierre SIGTERM/SIGINT. El servicio Docker corre como usuario no root.

`database/migrations/` contiene SQL versionado, transaccional, con checksum SHA-256 y bloqueo de migraciones. No edite migraciones aplicadas; agregue la siguiente. `database/init.sql` es una alternativa para inicialización manual de una base vacía y registra el mismo checksum; el arranque normal usa el runner. Si existen tablas sin historial de migraciones, se detiene en vez de sobrescribirlas: respalde, compare el esquema y escriba una migración de adopción revisada. No se convierten booleanos en GPS ni se eliminan registros.

## OpenAPI y pruebas

Resultado de la ejecución realizada: [informe de verificación](docs/verificacion.md).

Importe [docs/openapi.yaml](docs/openapi.yaml) en Swagger Editor u otra herramienta compatible. No se publica documentación por HTTP para conservar únicamente cuatro endpoints. Para regenerar archivos, con Node.js 24 instalado, ejecute `npm ci` y `npm run artifacts` desde esta carpeta. Para compilar: `npm run build`. No necesita esos comandos para consumir la API en Docker.

Desde la raíz: `docker compose exec denuncias npm test`. La suite crea una base PostgreSQL real `proteccion_test_<uuid>` y un directorio temporal, prueba HTTP, imágenes/PDF/MP4 reales, transacciones, concurrencia, filtros y errores, y elimina solo sus recursos. Requiere CREATEDB. No se usan respuestas simuladas para afirmar persistencia.

Verificación de persistencia con reinicio real (interrumpe brevemente PostgreSQL compartido):

```bash
docker compose exec denuncias node scripts/persistence.mjs prepare
docker compose restart postgres denuncias
# Esperar a que ambos aparezcan healthy en docker compose ps
docker compose exec denuncias node scripts/persistence.mjs verify
```

Compara datos y hashes de foto/PDF; al terminar limpia administrativamente solo su registro temporal. No crea DELETE HTTP. `prepare/verify` usa un archivo de estado en el contenedor: use restart, no down entre ambos pasos.

## Alcance y problemas comunes

Los datos del denunciante son personales. Este despliegue se limita a localhost y no implementa autenticación. Antes de producción hacen falta autenticación, autorización por denuncia, TLS, política de conservación/protección de datos y un mecanismo controlado de acceso a binarios. La validación de formato no sustituye un análisis antimalware.

- Conexión: PostgreSQL interno postgres:5432; externo localhost:5433.
- Base no creada: revisar permisos CREATEDB y `docker compose logs denuncias`.
- 400 al actualizar: enviar todos los obligatorios; revisar máximo acumulado de evidencias.
- 413/415: revisar tamaño, MIME, extensión y contenido; PDFs cifrados e imágenes animadas no se aceptan.
- Datos no aparecen en pgAdmin: refrescar Databases y abrir Query Tool en ProteccionAnimal, no PetAlert.
- API no carga una página inicial: es normal; use `/api/denuncias`. No hay `/health` ni Swagger servido.
