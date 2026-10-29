-- Si hay tablas previas sin historial, detenerse para revisar una migracion de adopcion.
-- No se reemplaza ni borra ningun esquema existente.
CREATE TABLE "Denuncias" (
 id BIGSERIAL PRIMARY KEY,
 nombre VARCHAR(100), raza VARCHAR(100), color VARCHAR(100), collar_gps VARCHAR(50), foto TEXT,
 nombre_denunciante VARCHAR(150) NOT NULL,
 telefono VARCHAR(30), correo VARCHAR(150), descripcion_denuncia TEXT NOT NULL,
 tipo_denuncia SMALLINT NOT NULL CONSTRAINT chk_tipo_denuncia CHECK (tipo_denuncia IN (1,2)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_nombre_denunciante CHECK (length(btrim(nombre_denunciante)) > 0),
 CONSTRAINT chk_descripcion_denuncia CHECK (length(btrim(descripcion_denuncia)) BETWEEN 1 AND 10000),
 CONSTRAINT chk_contacto CHECK (NULLIF(btrim(telefono),'') IS NOT NULL OR NULLIF(btrim(correo),'') IS NOT NULL),
 CONSTRAINT chk_gps CHECK (collar_gps IS NULL OR collar_gps ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
 CONSTRAINT chk_animal CHECK ((nombre IS NULL OR length(btrim(nombre)) > 0) AND (raza IS NULL OR length(btrim(raza)) > 0) AND (color IS NULL OR length(btrim(color)) > 0)),
 CONSTRAINT chk_telefono CHECK (telefono IS NULL OR (telefono ~ '^\+?[0-9 ()-]+$' AND length(regexp_replace(telefono,'[^0-9]','','g')) >= 7)),
 CONSTRAINT chk_correo CHECK (correo IS NULL OR correo ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
CREATE TABLE "DenunciaEvidencias" (
 id BIGSERIAL PRIMARY KEY,
 denuncia_id BIGINT NOT NULL REFERENCES "Denuncias"(id),
 nombre_archivo VARCHAR(255) NOT NULL, ruta_archivo TEXT NOT NULL UNIQUE,
 tipo_archivo VARCHAR(100) NOT NULL, tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes BETWEEN 1 AND 20971520),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_denuncias_tipo ON "Denuncias"(tipo_denuncia);
CREATE INDEX idx_denuncias_fecha ON "Denuncias"(created_at DESC,id DESC);
CREATE INDEX idx_evidencias_denuncia ON "DenunciaEvidencias"(denuncia_id);
CREATE FUNCTION denuncias_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER trg_denuncias_updated_at BEFORE UPDATE ON "Denuncias" FOR EACH ROW EXECUTE FUNCTION denuncias_updated_at();
CREATE FUNCTION limitar_evidencias() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "Denuncias" WHERE id=NEW.denuncia_id FOR UPDATE;
 IF (SELECT count(*) FROM "DenunciaEvidencias" WHERE denuncia_id=NEW.denuncia_id AND id<>NEW.id) >= 5 THEN
   RAISE EXCEPTION 'Limite de evidencias' USING ERRCODE='23514',CONSTRAINT='chk_max_evidencias';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_limitar_evidencias BEFORE INSERT OR UPDATE ON "DenunciaEvidencias" FOR EACH ROW EXECUTE FUNCTION limitar_evidencias();
CREATE TABLE file_cleanup (ruta TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
