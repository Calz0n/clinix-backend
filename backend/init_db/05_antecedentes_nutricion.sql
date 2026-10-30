-- Instantánea de los antecedentes en cada evaluación nutricional.
-- Las evaluaciones anteriores conservan sus demás datos.
ALTER TABLE consultas_nutricion
  ADD COLUMN IF NOT EXISTS antecedentes_patologicos JSONB NOT NULL DEFAULT '{}'::jsonb;
