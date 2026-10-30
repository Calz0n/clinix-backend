-- Diagnósticos por sesión, sin reinterpretar ni sobrescribir las notas antiguas.
ALTER TABLE consultas_psicologia
  ADD COLUMN IF NOT EXISTS diagnosticos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estado_diagnostico VARCHAR(20) NOT NULL DEFAULT 'LEGADO';

CREATE OR REPLACE FUNCTION diagnosticos_psicologia_validos(datos JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  item JSONB;
  codigos TEXT[] := ARRAY[]::TEXT[];
  codigo TEXT;
  principales INTEGER := 0;
BEGIN
  IF datos IS NULL OR jsonb_typeof(datos) <> 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(datos) > 20 THEN RETURN FALSE; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(datos) LOOP
    IF jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item->'cie10') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'descripcion') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'principal') IS DISTINCT FROM 'boolean' THEN RETURN FALSE; END IF;
    codigo := item->>'cie10';
    IF codigo !~ '^[A-Z][0-9]{2}(\.[A-Z0-9]{1,4})?$'
       OR length(btrim(item->>'descripcion')) NOT BETWEEN 1 AND 200
       OR codigo = ANY(codigos) THEN RETURN FALSE; END IF;
    codigos := array_append(codigos, codigo);
    IF (item->>'principal')::BOOLEAN THEN principales := principales + 1; END IF;
  END LOOP;
  RETURN jsonb_array_length(datos) = 0 OR principales = 1;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'psicologia_diagnosticos_consistentes'
                 AND conrelid = 'consultas_psicologia'::regclass) THEN
    ALTER TABLE consultas_psicologia ADD CONSTRAINT psicologia_diagnosticos_consistentes CHECK (
      diagnosticos_psicologia_validos(diagnosticos) AND (
        (estado_diagnostico = 'REGISTRADO' AND jsonb_array_length(diagnosticos) > 0) OR
        (estado_diagnostico IN ('EN_EVALUACION', 'LEGADO') AND jsonb_array_length(diagnosticos) = 0)
      )
    );
  END IF;
END $$;
