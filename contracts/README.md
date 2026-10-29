# contracts

Contratos HTTP disponibles:

- Mascotas: [petalert.openapi.json](petalert.openapi.json), también servido en http://localhost:3000/openapi.json y Swagger en http://localhost:3000/api-docs.
- Denuncias: [openapi.yaml](../policia-mock/docs/openapi.yaml). Se importa como archivo; no hay ruta HTTP de documentación en esa API.

Los contratos se generan con `npm run artifacts` desde la carpeta del servicio correspondiente, con Node.js 24 y `npm ci` ejecutado previamente. Para consumir los servicios no necesita regenerarlos: utilice los archivos Postman y siga la [guía principal](../README.md).
