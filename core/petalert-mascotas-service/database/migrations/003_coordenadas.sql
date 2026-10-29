ALTER TABLE "Mascotas" ADD COLUMN coordenadas JSONB;
ALTER TABLE "Mascotas" ADD CONSTRAINT chk_mascotas_coordenadas CHECK (
  coordenadas IS NULL OR CASE
    WHEN jsonb_typeof(coordenadas) = 'object'
      AND coordenadas ?& ARRAY['latitud', 'longitud']
      AND coordenadas - 'latitud' - 'longitud' = '{}'::jsonb
      AND jsonb_typeof(coordenadas->'latitud') = 'number'
      AND jsonb_typeof(coordenadas->'longitud') = 'number'
    THEN (coordenadas->>'latitud')::numeric BETWEEN -90 AND 90
      AND (coordenadas->>'longitud')::numeric BETWEEN -180 AND 180
    ELSE FALSE
  END
);
COMMENT ON COLUMN "Mascotas".coordenadas IS 'Ubicacion WGS84 en grados decimales: {latitud, longitud}; NULL si no se conoce.';
