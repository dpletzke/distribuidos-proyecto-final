-- No convertir booleanos ni eliminar duplicados. Toda la migracion es transaccional.
DO $$
DECLARE tipo TEXT; conflictos TEXT;
BEGIN
 SELECT data_type INTO tipo FROM information_schema.columns
 WHERE table_schema='public' AND table_name='Mascotas' AND column_name='collar_gps';
 IF tipo IS NULL OR tipo NOT IN ('character varying','text','character') THEN
   RAISE EXCEPTION 'Migracion detenida: collar_gps tiene tipo %. Conserve los datos y resuelva los valores segun README antes de continuar.', tipo;
 END IF;
 SELECT string_agg(id::text, ',') INTO conflictos FROM "Mascotas"
 WHERE collar_gps IS NOT NULL AND (length(upper(btrim(collar_gps))) > 50 OR upper(btrim(collar_gps)) !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$');
 IF conflictos IS NOT NULL THEN RAISE EXCEPTION 'GPS invalidos en IDs: %', conflictos; END IF;
 SELECT string_agg(ids, ';') INTO conflictos FROM (
   SELECT string_agg(id::text, ',') AS ids FROM "Mascotas" WHERE collar_gps IS NOT NULL
   GROUP BY upper(btrim(collar_gps)) HAVING count(*) > 1
 ) d;
 IF conflictos IS NOT NULL THEN RAISE EXCEPTION 'GPS duplicados tras normalizar; grupos de IDs: %', conflictos; END IF;
END $$;
ALTER TABLE "Mascotas" ALTER COLUMN collar_gps TYPE VARCHAR(50);
UPDATE "Mascotas" SET collar_gps=upper(btrim(collar_gps)) WHERE collar_gps IS DISTINCT FROM upper(btrim(collar_gps));
ALTER TABLE "Mascotas" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Mascotas" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Mascotas" DROP CONSTRAINT IF EXISTS uq_mascotas_collar_gps;
ALTER TABLE "Mascotas" ADD CONSTRAINT uq_mascotas_collar_gps UNIQUE (collar_gps);
ALTER TABLE "Mascotas" DROP CONSTRAINT IF EXISTS chk_mascotas_collar_gps_formato;
ALTER TABLE "Mascotas" ADD CONSTRAINT chk_mascotas_collar_gps_formato CHECK (
 collar_gps IS NULL OR (collar_gps ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND collar_gps=upper(btrim(collar_gps)))
);
ALTER TABLE "Mascotas" DROP CONSTRAINT IF EXISTS chk_mascotas_textos;
ALTER TABLE "Mascotas" ADD CONSTRAINT chk_mascotas_textos CHECK (
 length(btrim(nombre)) BETWEEN 1 AND 100 AND length(btrim(raza)) BETWEEN 1 AND 100 AND length(btrim(color)) BETWEEN 1 AND 100
);
CREATE OR REPLACE FUNCTION mascotas_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_mascotas_updated_at ON "Mascotas";
CREATE TRIGGER trg_mascotas_updated_at BEFORE UPDATE ON "Mascotas" FOR EACH ROW EXECUTE FUNCTION mascotas_updated_at();
CREATE TABLE IF NOT EXISTS foto_cleanup (ruta TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
