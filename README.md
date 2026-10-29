# PetAlert y ProteccionAnimal: ejecución local

Este repositorio contiene dos APIs REST y una interfaz web para consultar sus bases de datos. No incluye frontend. Con Docker Desktop puede levantar todo sin instalar Node.js, PostgreSQL, FFmpeg ni pgAdmin en su equipo.

## 1. Requisitos

- Docker Desktop iniciado en modo **Linux containers**, con Docker Compose v2 actualizado.
- Git si va a clonar el repositorio; también puede descargar y descomprimir el ZIP.
- Postman Desktop para enviar solicitudes con archivos. La primera compilación necesita Internet para descargar imágenes y dependencias.
- Puertos locales libres: **3000, 3001, 5050 y 5433**.

Clone usando la URL de este repositorio o descargue su ZIP. Abra una terminal en la carpeta que contiene `docker-compose.yml` y `.env.example`. Los comandos siguientes se ejecutan desde esa raíz, sin depender del nombre o ubicación de la carpeta.

Compruebe Docker:

```bash
docker version
docker compose version
```

`docker version` debe mostrar Client y Server. Si falta Server, inicie Docker Desktop antes de continuar.

## 2. Crear la configuración local

El archivo `.env` no se incluye en Git y **no se genera automáticamente** al clonar. Créelo desde el ejemplo. Si ya existe, consérvelo.

**Windows / PowerShell:**

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

**Linux / macOS / Git Bash:**

```bash
test -f .env || cp .env.example .env
# Abra .env en su editor.
```

Cambie al menos estos valores antes del primer arranque:

| Variable | Qué configurar |
|---|---|
| `POSTGRES_PASSWORD` | Su contraseña para PostgreSQL; reemplace `change_me` |
| `PGADMIN_PASSWORD` | Otra contraseña para entrar a pgAdmin web; reemplace `change_me_pgadmin` |
| `PGADMIN_EMAIL` | Correo de acceso a pgAdmin; puede conservar `admin@petalert.com` |

Para simplificar la configuración del archivo, use contraseñas largas con letras y números. No publique el `.env`.

Conserve inicialmente `POSTGRES_USER=petalert_user` y los puertos del ejemplo. Compose utiliza `POSTGRES_USER` y `POSTGRES_PASSWORD` para PostgreSQL y ambas APIs. Las variables `DB_*` del ejemplo están destinadas al desarrollo Node directo: **no necesita editarlas para ejecutar Docker**. Los nombres de las bases están fijados por Compose: `PetAlert` y `ProteccionAnimal`.

## 3. Levantar los servicios

```bash
docker compose up -d --build
docker compose ps
```

El primer arranque puede tardar varios minutos. Espere hasta que los **cuatro servicios** aparezcan `healthy`:

| Servicio Compose | Función | Acceso desde el equipo |
|---|---|---|
| `api` | Mascotas | http://localhost:3000/api/mascotas |
| `denuncias` | Protección animal | http://localhost:3001/api/denuncias |
| `pgadmin` | Administración web | http://localhost:5050 |
| `postgres` | PostgreSQL 16 compartido | `localhost:5433` (conexión SQL, no página web) |

Las bases, tablas y migraciones se crean automáticamente. No ejecute scripts SQL manualmente para una instalación nueva.

Si algún servicio no inicia:

```bash
docker compose logs --tail 100 postgres api denuncias pgadmin
```

Para comprobar desde el navegador:

- [Salud de PetAlert](http://localhost:3000/health): debe mostrar `database: connected`.
- [Lista de mascotas](http://localhost:3000/api/mascotas): una base nueva devuelve `[]`.
- [Lista de denuncias](http://localhost:3001/api/denuncias): una base nueva devuelve `total: 0` y `data: []`.
- [Swagger de mascotas](http://localhost:3000/api-docs): permite probar con **Try it out → Execute**.

Denuncias no tiene `/health` ni `/api-docs`; su comprobación Docker es interna. Es normal recibir 404 en esas rutas o al abrir solamente `http://localhost:3001/`.

## 4. Empezar con Postman

En Postman Desktop seleccione **Import → Files** e importe la colección y el entorno de cada servicio:

| API | Colección | Entorno |
|---|---|---|
| Mascotas | [PetAlert.postman_collection.json](core/petalert-mascotas-service/postman/PetAlert.postman_collection.json) | [PetAlert.postman_environment.json](core/petalert-mascotas-service/postman/PetAlert.postman_environment.json) |
| Denuncias | [ProteccionAnimal.postman_collection.json](policia-mock/postman/ProteccionAnimal.postman_collection.json) | [ProteccionAnimal.postman_environment.json](policia-mock/postman/ProteccionAnimal.postman_environment.json) |

**Seleccione el entorno correspondiente antes de enviar solicitudes.** Ambos entornos usan una variable `baseUrl`, pero con puertos distintos. Si ve `{{baseUrl}}` sin resolver o errores de ruta, revise el entorno seleccionado.

### Mascotas: primera solicitud

1. Seleccione **PetAlert local** (`baseUrl=http://localhost:3000`).
2. Abra **Registrar mascota con foto opcional** y pulse **Send**. Los datos de ejemplo ya están cargados.
3. Espere **201 Created**. El script guarda el ID real en `mascotaId`.
4. Ejecute **Consultar por ID** y **Listar mascotas**.
5. Ejecute **Eliminar mascota** solo cuando termine; responde **204** y elimina ese registro y su foto.

Para incluir fotografía, en **Body → form-data** active `foto`, seleccione tipo **File** y elija JPG, PNG o WEBP de hasta 5 MB. Los campos `nombre`, `raza` y `color` son Text obligatorios. Puede desactivar `collar_gps` y `coordenadas` si no los necesita. `coordenadas` es Text con JSON, por ejemplo `{"latitud":6.2442,"longitud":-75.5812}`.

No configure `Content-Type` manualmente con form-data: Postman debe generar el boundary. El GPS de mascotas es único y se normaliza; la colección genera uno por registro para evitar conflictos en ejecuciones sucesivas.

### Denuncias: primera solicitud

1. Seleccione **ProteccionAnimal local** (`baseUrl=http://localhost:3001`).
2. Abra **Crear denuncia**. En **Body → form-data**, `datos` ya contiene un JSON válido; los archivos están deshabilitados inicialmente.
3. Pulse **Send** y espere **201 Created**. La respuesta incluye `id_denuncia`; el script lo guarda en `denunciaId`.
4. Ejecute **Consultar denuncia**, **Listar denuncias** y luego **Actualizar denuncia** si desea cambiarla.

Para adjuntar archivos en POST o PUT, active `foto` y/o `evidencias` como File. Puede repetir la clave `evidencias`. Foto: JPG/PNG/WEBP hasta 5 MB. Evidencias: imágenes, PDF o MP4 hasta 20 MB cada una, máximo cinco acumuladas por denuncia.

La denuncia exige `nombre_denunciante`, `descripcion_denuncia`, `tipo_denuncia` (1 = pérdida, 2 = maltrato) y teléfono o correo. PUT requiere nuevamente esos datos; los opcionales omitidos pasan a null. Los archivos existentes se conservan si no adjunta otros. Una foto nueva reemplaza la anterior y las evidencias nuevas se agregan.

**No hay DELETE de denuncias.** Los registros que cree manualmente permanecerán en la base. Sus respuestas incluyen metadatos de archivos, pero no URLs de descarga; la visualización de esos binarios queda para una fase posterior.

### Referencia rápida de operaciones

| Servicio | Método y ruta | Resultado |
|---|---|---|
| Mascotas, puerto 3000 | `POST /api/mascotas` | Registrar, con foto opcional |
| Mascotas, puerto 3000 | `GET /api/mascotas/:id` | Consultar |
| Mascotas, puerto 3000 | `GET /api/mascotas` | Listar |
| Mascotas, puerto 3000 | `DELETE /api/mascotas/:id` | Eliminar |
| Denuncias, puerto 3001 | `POST /api/denuncias` | Registrar con foto y evidencias opcionales |
| Denuncias, puerto 3001 | `PUT /api/denuncias/:id` | Actualizar datos y archivos |
| Denuncias, puerto 3001 | `GET /api/denuncias/:id` | Consultar |
| Denuncias, puerto 3001 | `GET /api/denuncias` | Listar con filtros y paginación |

`:id` representa un ID real devuelto al crear; no se escribe literalmente en la URL. Los IDs de mascotas y denuncias son independientes. Consulte los detalles de [mascotas](core/petalert-mascotas-service/README.md) y [denuncias](policia-mock/README.md).

## 5. Ver las tablas desde el navegador

1. Abra [pgAdmin](http://localhost:5050).
2. Ingrese con **PGADMIN_EMAIL y PGADMIN_PASSWORD** de su `.env`.
3. Expanda **Servers → PetAlert → PetAlert - PostgreSQL 16**.
4. Cuando pida la contraseña del servidor, use **POSTGRES_PASSWORD**, no la contraseña web.
5. Refresque **Databases** y elija **PetAlert** o **ProteccionAnimal**.
6. Abra **Schemas → public → Tables**. Clic derecho en la tabla → **View/Edit Data → All Rows**.

Si cambió POSTGRES_USER, ajuste el usuario en las propiedades del servidor preconfigurado. pgAdmin en Docker usa host `postgres`, puerto `5432`. Un cliente SQL instalado en su equipo usa host `localhost`, puerto `5433`.

También puede abrir **Query Tool** sobre la base correspondiente:

```sql
-- En la base PetAlert:
SELECT id, nombre, collar_gps, coordenadas, foto FROM "Mascotas" ORDER BY id;
```

```sql
-- En la base ProteccionAnimal:
SELECT * FROM "Denuncias" ORDER BY id DESC;
SELECT * FROM "DenunciaEvidencias" ORDER BY denuncia_id, id;
```

**http://localhost:5433 no es una página web.** Ese puerto recibe conexiones PostgreSQL; la interfaz del navegador está en el 5050.

## 6. Ejecutar las pruebas

Con los servicios levantados, desde la raíz:

```bash
docker compose exec api npm test
docker compose exec denuncias npm test
```

Las suites crean bases PostgreSQL y directorios temporales propios, prueban HTTP y archivos reales y limpian sus recursos. No vacían las bases de uso normal. El usuario PostgreSQL creado por Compose tiene los permisos necesarios; si utiliza un rol restringido, las pruebas necesitan CREATEDB.

Se comprueban validaciones, coordenadas, GPS, archivos, concurrencia, transacciones y operaciones de ambas APIs. No necesita Node.js en el host para ejecutar estas pruebas. Los informes en `docs/` registran ejecuciones anteriores; vuelva a correrlas para verificar su equipo.

## 7. Detener, reiniciar y actualizar

```bash
# Ver estado y logs
docker compose ps
docker compose logs -f api denuncias

# Detener servicios conservando contenedores y datos
docker compose stop

# Volver a levantar
docker compose up -d

# Reconstruir después de cambiar código o descargar cambios
docker compose up -d --build

# Retirar contenedores conservando volúmenes
docker compose down
```

El proyecto se llama `petalert-mascotas` y usa cuatro volúmenes persistentes: `postgres_data` (ambas bases), `uploads_data` (fotos de mascotas), `denuncias_uploads` y `pgadmin_data`. Docker antepone el nombre del proyecto a cada volumen. No use `docker compose down -v` si necesita conservar información.

Cambiar las contraseñas en `.env` después del primer arranque **no cambia las contraseñas ya guardadas** en PostgreSQL o pgAdmin. Actualícelas en esos servicios y después en el `.env`; no elimine volúmenes para solucionar una contraseña sin respaldar los datos.

## 8. Problemas frecuentes

| Problema | Qué revisar |
|---|---|
| Docker no conecta | Docker Desktop iniciado, modo Linux y `docker version` con Server |
| Falta una variable al ejecutar Compose | `.env` creado en la raíz; POSTGRES_PASSWORD y PGADMIN_PASSWORD no vacías |
| Puerto ocupado | Cambie PORT (mascotas), DENUNCIAS_PORT, PGADMIN_PORT o POSTGRES_PORT en `.env` y ejecute `up -d`; ajuste Postman y clientes SQL |
| 404 al consumir | Puerto y ruta correctos; entorno Postman correspondiente e ID creado antes |
| Error 400 | Campos obligatorios, JSON válido y tipos correctos; en denuncias multipart el JSON va en `datos` |
| Error 409 en mascotas | GPS ya utilizado; use otro código u omita el campo |
| Error 413 o 415 | Tamaño, extensión y contenido del archivo; no basta con renombrarlo |
| Archivo no se envía desde Postman | Campo activado y tipo File; archivo seleccionado en su equipo |
| Base no aparece en pgAdmin | Ambos servicios API saludables; refrescar Databases y revisar logs |
| API unhealthy | `docker compose logs --tail 100 postgres api denuncias`; revise conexión, permisos y migraciones |
| Contraseña no funciona después de editar `.env` | El volumen ya estaba inicializado; cambiar la variable no cambia el usuario existente |

Los puertos solo se publican en localhost. Este despliegue es para desarrollo local y no tiene autenticación de usuarios de las APIs. Para acceso desde un teléfono físico o producción será necesario configurar red, autenticación y autorización, especialmente para datos personales de denuncias.

## Organización y documentación

| Carpeta | Contenido |
|---|---|
| [core/petalert-mascotas-service](core/petalert-mascotas-service/README.md) | API de mascotas, pruebas y Postman |
| [policia-mock](policia-mock/README.md) | API de denuncias, pruebas, OpenAPI y Postman |
| [infra](infra/README.md) | Configuración de pgAdmin; Compose está en la raíz |
| [contracts](contracts/README.md) | Contrato exportado de mascotas |
| [docs](docs/README.md) | Informes de verificación |
| `app`, `collar-sim`, `probe`, `loadtest` | Directorios conservados para otras fases; no se ejecutan con este Compose |

Arquitectura de ambas APIs: Routes → Controllers → Services → Repositories → PostgreSQL. Cada servicio mantiene sus migraciones versionadas. No edite SQL ya aplicado ni ejecute scripts iniciales sobre una base existente: revise la documentación del servicio antes de migrar datos antiguos.
