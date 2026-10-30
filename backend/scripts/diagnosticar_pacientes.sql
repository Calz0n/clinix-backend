-- Sólo inspección del esquema: no modifica ni muestra expedientes de pacientes.
SELECT table_name, column_name, data_type, udt_name,
       character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('pacientes', 'atenciones_clinicas', 'tutores')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS tabla, con.conname AS restriccion,
       pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('pacientes', 'atenciones_clinicas', 'tutores')
ORDER BY c.relname, con.conname;
