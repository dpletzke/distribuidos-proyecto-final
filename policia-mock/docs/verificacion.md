# Verificación de ProteccionAnimal

Implementación y comprobaciones realizadas el 29 de octubre de 2026.

## Despliegue

- Carpeta: `policia-mock` del repositorio clonado.
- Contenedor: `proteccionanimal-denuncias-service`, servicio Compose `denuncias`.
- HTTP local: `http://localhost:3001/api/denuncias`.
- PostgreSQL 16 compartido: host Docker `postgres:5432`, acceso Windows `localhost:5433`.
- Base independiente: `ProteccionAnimal`, credenciales del `.env` raíz sin modificarlas.
- Tablas `"Denuncias"` y `"DenunciaEvidencias"`, además de historial de migraciones y cola de limpieza.
- No se creó otro PostgreSQL ni se ocupó el puerto 5434, atendiendo a la instrucción del usuario.

## Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| Compilación TypeScript local y dentro de Docker | Correcta |
| Generación de OpenAPI YAML y colección/entorno Postman | Correcta |
| `docker compose exec -T denuncias npm test` | 14 pruebas aprobadas, 0 fallidas, 0 omitidas |
| Creación sin archivos, tipos Pérdida y Maltrato | IDs reales y datos almacenados en PostgreSQL |
| GPS repetido en denuncias distintas | Permitido |
| POST multipart con foto, imagen, PDF y MP4 reales | Archivos persistidos, evidencias asociadas al ID generado |
| Consulta y lista filtrada/paginada | Datos reales, total antes de paginar, página vacía y orden correctos |
| PUT sin archivos | Conserva foto/evidencias; reemplaza datos y actualiza auditoría |
| PUT con archivos | Reemplaza foto y elimina la anterior; agrega evidencias |
| PUT concurrentes | Respeta máximo acumulado de cinco evidencias |
| Archivos falsos, tipo/extensión incorrectos y tamaño excesivo | Rechazados |
| Fallo SQL provocado al insertar evidencia | Rollback de denuncia y limpieza de archivos comprobados |
| Restricciones SQL directas | Tipo/contacto inválidos y sexta evidencia rechazados |
| Rutas ajenas al contrato | DELETE, PATCH, salud, documentación y descargas devuelven 404 |
| Contrato y colección | Cuatro operaciones REST y cuatro solicitudes principales |
| Compose ejecutado desde `policia-mock` | Mismo proyecto, servidor PostgreSQL, puertos y credenciales del Compose raíz |

La suite usa una base PostgreSQL temporal `proteccion_test_<uuid>` y una carpeta temporal. Las pruebas no vacían ni modifican datos de PetAlert o ProteccionAnimal. El mensaje de error interno durante la suite corresponde al fallo SQL intencional para comprobar rollback; esa prueba pasó.

## Persistencia y convivencia

Se ejecutaron `scripts/persistence.mjs prepare`, `docker compose restart postgres denuncias` y `scripts/persistence.mjs verify`. El registro, ID, fechas, fotografía y PDF sobrevivieron al reinicio; se compararon sus hashes SHA-256. Después se limpió administrativamente solo ese registro temporal y sus archivos. No existe DELETE HTTP ni se eliminaron volúmenes.

Verificación final desde Windows:

- `http://localhost:3001/api/denuncias`: HTTP 200, lista vacía después de limpiar la prueba.
- `http://localhost:3000/health`: HTTP 200, PetAlert conectado a PostgreSQL.
- `http://localhost:5050/login`: HTTP 200, pgAdmin disponible.
- Los cuatro contenedores aparecen saludables en `docker compose ps`.

La colección Postman y el OpenAPI son archivos importables; no se afirma haber ejecutado el Runner gráfico de Postman. La interfaz gráfica de pgAdmin no se automatizó: la base está en el servidor ya registrado y puede verse al refrescar Databases. No hay frontend ni mecanismo HTTP para visualizar binarios en esta fase.
