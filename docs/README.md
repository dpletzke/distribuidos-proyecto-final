# docs

Para instalar y consumir las APIs siga el [README principal](../README.md). Los siguientes documentos registran comprobaciones realizadas durante el desarrollo; no sustituyen la guía de instalación:

- [Verificación de mascotas](petalert-verificacion.md).
- [Verificación de denuncias](../policia-mock/docs/verificacion.md).

Para comprobar su instalación actual, desde la raíz ejecute `docker compose exec api npm test` y `docker compose exec denuncias npm test`. Ambas suites usan bases temporales propias.
