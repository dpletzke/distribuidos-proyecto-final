# PetAlert: servicio de mascotas

Servicio en `http://localhost:3000`, base `PetAlert`. Para instalar desde cero siga la [guia de inicio del repositorio](../../README.md). Todos los comandos Docker de esta pagina se ejecutan desde la raiz del repositorio.

```bash
docker compose up -d --build
docker compose exec api npm test
```

## Endpoints y validaciones

| Método | Ruta | Resultado |
|---|---|---|
| POST | `/api/mascotas` | 201, registro con foto opcional en la misma solicitud |
| GET | `/api/mascotas` | 200, todas por ID ascendente |
| GET | `/api/mascotas/:id` | 200 o 404 |
| DELETE | `/api/mascotas/:id` | 204 sin cuerpo, o 404 |
| GET | `/health` | 200 con conexión real, 503 si falla |

```json
{"nombre":"Max","raza":"Labrador","color":"Dorado","collar_gps":"CO-458","foto":null}
```

Nombre, raza y color: obligatorios, recortados, no vacíos y máximo 100 caracteres. El registro admite JSON o multipart/form-data. En JSON se permite omitir GPS y foto (null). En multipart omita los campos opcionales si no los necesita; no envie GPS vacio ni la cadena "null". Se rechazan propiedades desconocidas. JSON limitado a 64 KB. Fechas e IDs proceden de PostgreSQL. IDs BIGINT mayores que el entero seguro de JavaScript se devuelven como cadenas para no perder precisión; los demás como números.

Errores uniformes `{ "codigo": "...", "mensaje": "..." }`: 400 validación, 404 inexistente, 409 GPS duplicado, 413 tamaño excedido, 415 foto inválida, 500 interno, 503 base no disponible.

### Coordenadas para mapas

El campo opcional `coordenadas` es un objeto JSON con `latitud` y `longitud` numéricas en grados decimales WGS84. Latitud: -90 a 90; longitud: -180 a 180. Se requieren ambas cuando se envía una ubicación. Omitirlo o enviar `null` significa ubicación desconocida; no se asigna una ubicación ficticia a registros existentes.

En el registro JSON:

```json
{"nombre":"Max","raza":"Labrador","color":"Dorado","coordenadas":{"latitud":6.2442,"longitud":-75.5812}}
```

En Postman **Body → form-data**, agregue `coordenadas` como **Text** con valor `{"latitud":6.2442,"longitud":-75.5812}`; se puede enviar junto con `foto` como File. La colección ya incluye este campo. Tanto la consulta individual como la lista devuelven el objeto numérico, listo para usar en el frontend. Para GeoJSON, el orden de la posición es `[longitud, latitud]`; no invierta los campos al integrarlo.

La migración `003_coordenadas.sql` agrega una columna JSONB y un CHECK de estructura y rangos sin eliminar registros. Se aplica al arrancar la API. En pgAdmin refresque la tabla y ejecute:

```sql
SELECT id, nombre, coordenadas,
       (coordenadas->>'latitud')::double precision AS latitud,
       (coordenadas->>'longitud')::double precision AS longitud
FROM "Mascotas" ORDER BY id;
```

Se conservan las cuatro operaciones: las coordenadas se envían al registrar; esta fase no incorpora actualización de ubicación ni seguimiento GPS en tiempo real.

### Códigos GPS

Es `VARCHAR(50)`, no booleano. Se recortan espacios externos y se convierte a mayúsculas. Formato almacenado: `^[A-Z0-9]+(-[A-Z0-9]+)*$`; no admite vacíos ni guiones consecutivos/iniciales/finales. Se consulta la duplicidad antes de registrar. La restricción `uq_mascotas_collar_gps` garantiza unicidad incluso ante concurrencia; el error `23505` de esa restricción se traduce a 409. Otras restricciones no se confunden con GPS. PostgreSQL permite múltiples NULL. SQL directo debe enviar códigos normalizados; el CHECK rechaza los demás.

```json
{"codigo":"GPS_DUPLICADO","mensaje":"El código del collar GPS CO-458 ya se encuentra registrado en otra mascota."}
```

El trigger PostgreSQL modifica `updated_at` automáticamente.

### Fotos

En POST `/api/mascotas`, seleccione Body -> form-data: `nombre`, `raza`, `color` como Text, `collar_gps` como Text opcional y `foto` como File opcional. No defina Content-Type manualmente. JPG/JPEG, PNG y WEBP estáticos; máximo 5 MB y 25 millones de píxeles. Se validan extensión, MIME y decodificación completa; Sharp recodifica sin metadatos. Se generan UUID y se guarda en `/app/uploads`, publicado mediante `/uploads/...`.

En JSON, `foto` admite null o URL HTTP/HTTPS externa de hasta 2048 caracteres. Las rutas locales solo se asignan por multipart, evitando referencias compartidas y traversal. Las URLs externas no se descargan ni se eliminan.

El registro guarda mascota y foto en una sola operacion. Si falla, revierte la insercion y limpia el archivo. DELETE elimina tambien la foto local. La cola durable `foto_cleanup` registra archivos antes de escribirlos y los pendientes de borrado en la transaccion correspondiente; un bloqueo PostgreSQL coordina el recolector. Ante fallos se reintenta al arrancar y cada 60 segundos. No hay endpoints de actualizacion ni carga separada.

## Postman y contrato

Importe [coleccion Postman](postman/PetAlert.postman_collection.json) y [entorno Postman](postman/PetAlert.postman_environment.json). Seleccione el entorno **PetAlert local**, con `baseUrl=http://localhost:3000` y `mascotaId=1`. La coleccion tiene exactamente cuatro solicitudes: registrar, consultar por ID, listar y eliminar. El registro guarda el ID y genera un GPS por ejecucion. Para incluir foto, active el campo `foto` (deshabilitado inicialmente) y seleccione un archivo. Para registrar sin collar, desactive `collar_gps`. Incluye ejemplos y pruebas HTTP/JSON.

Fuente de verdad: `src/config/swagger.ts`. Regeneración del contrato exportado y los escenarios Postman:

```bash
cd core/petalert-mascotas-service
npm ci
npm run artifacts
```

No requiere cuenta ni publicación en Postman.


## Migraciones

`init.sql` inicializa volúmenes nuevos. El runner aplica archivos versionados en transacción y con bloqueo; `schema_migrations` registra versión y SHA-256. No modifique migraciones aplicadas: agregue una nueva. Un fallo revierte cambios y evita atender tráfico. No se borran datos.

La migración 002 detiene esquemas BOOLEAN, códigos inválidos o duplicados tras normalizar, reportando IDs en logs. Antes de intervenir una base existente haga respaldo. Resuelva duplicados con información verificada sin eliminar mascotas automáticamente.

Para un esquema BOOLEAN antiguo, conserve la columna original y revise cada registro manualmente con el dueño de los datos:

```sql
-- Solo tras respaldar y detener la API:
BEGIN;
ALTER TABLE "Mascotas" RENAME COLUMN collar_gps TO collar_gps_legacy;
ALTER TABLE "Mascotas" ADD COLUMN collar_gps VARCHAR(50);
-- Asignar códigos REALES por ID, nunca convertir true/false en códigos.
-- NULL solo después de confirmar que no hay código disponible.
COMMIT;
```

No reinicie hasta completar la revisión; conserve `collar_gps_legacy` como evidencia. El modelo HTTP no expone columnas legadas. Después reinicie API para aplicar restricciones.


## Desarrollo y pruebas

La ejecucion con Docker no requiere instalar Node en el equipo. Para desarrollo directo use Node.js 24, ejecute `npm ci` dentro de esta carpeta y cree aqui un `.env` local con las credenciales PostgreSQL del `.env` raiz, `DB_HOST=localhost`, `DB_PORT=5433`, `DB_NAME=PetAlert`, `PORT=3000` y `UPLOAD_DIR=./uploads`. Detenga antes la API Docker para liberar el puerto (`docker compose stop api`, desde la raiz). Inicie con `npm run dev`.

`npm run build` compila; `npm run test:unit` comprueba validadores. La suite completa se ejecuta desde la raiz con `docker compose exec api npm test`: crea una base temporal independiente y no vacia PetAlert. Necesita CREATEDB, disponible en el rol local de Compose.

Para probar persistencia desde la raiz, con Node 24 instalado y las dependencias locales del servicio instaladas, ejecute `node core/petalert-mascotas-service/scripts/persistence.mjs`. El script recrea los contenedores de todo el proyecto con down/up, conserva los volumenes y limpia solo su mascota de prueba. Esta comprobacion no es necesaria para empezar a consumir la API.

[Historial de verificacion](../../docs/petalert-verificacion.md).
