# infra

La infraestructura local se define en [docker-compose.yml](../docker-compose.yml): PostgreSQL 16 compartido, ambas APIs y pgAdmin web.

[pgadmin/servers.json](pgadmin/servers.json) registra el servidor PostgreSQL en pgAdmin al inicializar su volumen. Usa `postgres:5432` dentro de Docker y `petalert_user` como usuario inicial. Si cambia POSTGRES_USER, ajuste el usuario de esa conexión desde pgAdmin.

Siga la [guía de inicio](../README.md) para configurar el `.env`, levantar los servicios y acceder a pgAdmin en http://localhost:5050. No se despliegan Mosquitto, Prometheus ni Grafana en esta fase.
