-- Compatible con instalaciones nuevas y existentes. No borra registros.
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS numero_afiliacion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS grupo_sanguineo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS religion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ocupacion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tipo_poblacion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS area_servicio VARCHAR(100);

ALTER TABLE atenciones_clinicas
  ADD COLUMN IF NOT EXISTS area_servicio VARCHAR(100);

-- Las sedes se migran antes de atender peticiones, sin tareas en segundo plano.
ALTER TABLE unidades_medicas ADD COLUMN IF NOT EXISTS consultorios INT DEFAULT 4;
ALTER TABLE unidades_medicas ADD COLUMN IF NOT EXISTS especialidades_activas JSONB DEFAULT '["Medicina General", "Odontología", "Nutrición", "Psicología", "Enfermería / Triaje"]'::jsonb;
ALTER TABLE unidades_medicas ADD COLUMN IF NOT EXISTS medicos_por_especialidad JSONB DEFAULT '{}'::jsonb;

-- Conservar la fecha del triaje para procedimientos previos sin fecha propia.
ALTER TABLE procedimientos_enfermeria ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMP;
UPDATE procedimientos_enfermeria pe
SET fecha_hora = t.fecha_hora
FROM triaje_signos_vitales t
WHERE t.id = pe.triaje_id AND pe.fecha_hora IS NULL;
ALTER TABLE procedimientos_enfermeria ALTER COLUMN fecha_hora SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE procedimientos_enfermeria ALTER COLUMN fecha_hora SET NOT NULL;
