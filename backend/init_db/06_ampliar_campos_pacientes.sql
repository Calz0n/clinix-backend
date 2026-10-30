-- Ampliar sólo columnas antiguas más estrechas que el contrato actual.
-- No reducir tamaños ni truncar datos existentes.
DO $migration$
DECLARE
  campo RECORD;
  longitud INTEGER;
BEGIN
  FOR campo IN SELECT * FROM (VALUES
    ('pacientes', 'nombres', 80),
    ('pacientes', 'apellido_paterno', 60),
    ('pacientes', 'apellido_materno', 60),
    ('pacientes', 'numero_expediente', 30),
    ('pacientes', 'curp', 18),
    ('pacientes', 'estado_civil', 25),
    ('pacientes', 'escolaridad', 40),
    ('pacientes', 'calle_numero', 150),
    ('pacientes', 'colonia', 100),
    ('pacientes', 'codigo_postal', 5),
    ('pacientes', 'telefono', 15),
    ('pacientes', 'derechohabiencia', 50),
    ('pacientes', 'nombre_programa', 100),
    ('pacientes', 'numero_afiliacion', 100),
    ('pacientes', 'grupo_sanguineo', 50),
    ('pacientes', 'religion', 100),
    ('pacientes', 'ocupacion', 100),
    ('pacientes', 'tipo_poblacion', 100),
    ('pacientes', 'area_servicio', 100),
    ('atenciones_clinicas', 'area_servicio', 100),
    ('atenciones_clinicas', 'tipo_atencion', 20),
    ('tutores', 'telefono_contacto', 15)
  ) AS limites(tabla, columna, maximo)
  LOOP
    SELECT character_maximum_length INTO longitud
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = campo.tabla AND column_name = campo.columna
      AND data_type IN ('character varying', 'character');
    IF longitud IS NOT NULL AND longitud < campo.maximo THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(%s)', campo.tabla, campo.columna, campo.maximo);
    END IF;
  END LOOP;
END $migration$;
