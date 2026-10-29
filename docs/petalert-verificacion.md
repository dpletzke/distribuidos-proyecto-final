# Verificación PetAlert — 29 de octubre de 2026

## Coordenadas para mapas

Se añadió la migración `003_coordenadas.sql`: columna opcional JSONB `coordenadas` con latitud/longitud numéricas y CHECK de estructura y rangos. Los registros anteriores conservan sus datos y reciben NULL en el nuevo campo. El registro acepta el objeto en JSON o texto JSON en multipart junto con la foto; consulta individual y lista lo devuelven. Se mantienen cuatro operaciones.

Compilación y regeneración de Swagger/OpenAPI/Postman correctas. Suite actual: **24 pruebas aprobadas con PostgreSQL real**, incluyendo persistencia de coordenadas, consulta/lista, multipart con foto, valores límite, omisión/null y rechazo de coordenadas inválidas en API y SQL directo. API, PostgreSQL y pgAdmin quedaron saludables. README y colección Postman incluyen ejemplos para consumir el nuevo campo.

## Ajuste vigente: cuatro operaciones de mascotas

Se dejaron únicamente POST `/api/mascotas` (registro con foto opcional en la misma solicitud), GET `/api/mascotas/:id` (consulta), GET `/api/mascotas` (lista) y DELETE `/api/mascotas/:id` (borrado). PUT, PATCH y POST `/:id/foto` fueron retirados. `/health` permanece como comprobación técnica de Docker.

El registro admite multipart/form-data con nombre, raza, color, collar_gps opcional y archivo foto opcional; también conserva JSON para registro sin archivo. Mascota y foto se guardan en una sola operación, con rollback y limpieza del archivo ante fallos SQL. Swagger, OpenAPI, README, colección Postman (exactamente cuatro solicitudes) y script de persistencia fueron actualizados.

Validación posterior al ajuste: compilación correcta, **21 pruebas aprobadas contra PostgreSQL real**, incluyendo creación con PNG/JPEG/WEBP, multipart sin foto, duplicados concurrentes con imagen, rollback ante fallo SQL y ausencia de endpoints retirados. El script de persistencia actualizado también pasó: registro, auditoría y bytes de foto sobreviven a down/up. Ambos contenedores quedaron saludables. No se eliminaron volúmenes ni registros del usuario.

Las secciones siguientes documentan la implementación inicial, anterior a este ajuste.

## Resultado

Servicio implementado en `core/petalert-mascotas-service`, iniciado con el Compose raíz. Contenedores `petalert-mascotas-service` y `petalert-postgres` saludables. Base real `PetAlert` sobre PostgreSQL 16.15. No se implementó frontend.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| `npm run build` | Compilación TypeScript correcta, también dentro de Docker |
| `npm run test:unit` | 4 pruebas aprobadas |
| `npm run artifacts` | OpenAPI, colección y entorno Postman generados |
| `docker compose up -d --build` | Dos contenedores iniciados |
| `docker compose exec -T api npm test` | 22 pruebas aprobadas, 0 fallidas, 0 omitidas |
| `node core/petalert-mascotas-service/scripts/persistence.mjs` | Registro, auditoría y bytes de foto conservados después de down/up |
| Conexión `pg.Client` desde Windows a localhost:5433 | Base PetAlert y PostgreSQL 16.15 confirmados |
| HTTP desde Windows `/health` | 200, database connected |
| HTTP desde Windows `/api-docs/` | 200, HTML Swagger |
| HTTP desde Windows `/api/mascotas` | 200; lista vacía después de limpiar los registros de pruebas |
| `git diff --check` | Sin errores |

La suite usa PostgreSQL real en una base temporal independiente. Comprueba CRUD, códigos CO-458/co-458 normalizados, NULL múltiples, ocho creaciones simultáneas con un único éxito y siete conflictos, restricciones SQL directas, PUT/PATCH, cargas PNG/JPEG/WEBP, MIME/extensión/contenido, tamaño máximo, reemplazos concurrentes y limpieza, migraciones BOOLEAN/duplicados y disponibilidad. La prueba de 503 cierra el pool de la instancia de prueba; no apaga el PostgreSQL compartido. La prueba de persistencia sí recrea los contenedores del servicio y compara datos reales.

Los problemas iniciales de compilación y validación de ID se corrigieron antes de la ejecución final. No se afirma haber usado la interfaz gráfica de pgAdmin ni ejecutado el Runner gráfico de Postman: se verificó la conexión equivalente desde Windows, se generaron archivos importables y se probaron los endpoints por HTTP.

## Proyecto Docker anterior

El primer arranque encontró un proyecto preexistente `petalert` y reutilizó su volumen PostgreSQL 17. PostgreSQL 16 rechazó abrirlo por incompatibilidad. No se eliminaron volúmenes ni datos. Se retiraron únicamente los contenedores fallidos de esta ejecución y se cambió el nombre del nuevo proyecto a `petalert-mascotas`, con volúmenes independientes.

Se recreó `petalert-postgres-1` con PostgreSQL 17 usando `C:\Proyectos Visual Code\Distribuidos\compose.yaml`, sin arrancarlo. El volumen anterior `petalert_postgres_data` y el contenedor pgAdmin anterior se conservan. El servicio nuevo usa el puerto 5433; para arrancar ambos proyectos a la vez será necesario asignarles puertos distintos. No se importaron datos legados en la nueva base.

## Entrega

El archivo `.env` local contiene una contraseña aleatoria y está excluido de Git. Swagger está en http://localhost:3000/api-docs. Colección y entorno en `core/petalert-mascotas-service/postman/`. El README raíz explica operación, migraciones seguras, fotografías, pgAdmin y pruebas reproducibles.
