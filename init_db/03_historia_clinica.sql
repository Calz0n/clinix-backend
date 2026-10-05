-- =============================================================================
-- MIGRACIÓN: MÓDULO DE HISTORIA CLÍNICA (NOM-004-SSA3-2012)
-- Dirección de Salud Pública Municipal de Coatzacoalcos, Ver.
-- =============================================================================

CREATE TABLE IF NOT EXISTS historias_clinicas (
    id SERIAL PRIMARY KEY,
    paciente_id INT UNIQUE NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    usuario_registro_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- 1. Antecedentes Heredofamiliares (AHF)
    ahf_diabetes BOOLEAN DEFAULT FALSE NOT NULL,
    ahf_hipertension BOOLEAN DEFAULT FALSE NOT NULL,
    ahf_cardiopatias BOOLEAN DEFAULT FALSE NOT NULL,
    ahf_neoplasias BOOLEAN DEFAULT FALSE NOT NULL,
    ahf_nefropatias BOOLEAN DEFAULT FALSE NOT NULL,
    ahf_enfermedades_mentales BOOLEAN DEFAULT FALSE NOT NULL,
    ahf_otros TEXT,
    
    -- 2. Antecedentes Personales Patológicos (APP)
    app_alergias TEXT,
    app_quirurgicos TEXT,
    app_transfusionales TEXT,
    app_traumaticos TEXT,
    app_hospitalizaciones TEXT,
    app_cronico_degenerativas TEXT,
    app_otros TEXT,
    
    -- 3. Antecedentes Personales No Patológicos (APNP)
    apnp_tabaquismo BOOLEAN DEFAULT FALSE NOT NULL,
    apnp_tabaquismo_descripcion VARCHAR(150),
    apnp_alcoholismo BOOLEAN DEFAULT FALSE NOT NULL,
    apnp_alcoholismo_descripcion VARCHAR(150),
    apnp_toxicomania TEXT,
    apnp_vacunacion_completa BOOLEAN DEFAULT TRUE NOT NULL,
    apnp_vivienda_servicios VARCHAR(250),
    apnp_zoonosis VARCHAR(150),
    apnp_actividad_fisica VARCHAR(100),
    
    -- 4. Antecedentes Gineco-Obstétricos (AGO)
    ago_menarca SMALLINT CHECK (ago_menarca BETWEEN 8 AND 25),
    ago_ritmo_menstrual VARCHAR(30),
    ago_fum DATE,
    ago_gestas SMALLINT DEFAULT 0 CHECK (ago_gestas >= 0),
    ago_partos SMALLINT DEFAULT 0 CHECK (ago_partos >= 0),
    ago_cesareas SMALLINT DEFAULT 0 CHECK (ago_cesareas >= 0),
    ago_abortos SMALLINT DEFAULT 0 CHECK (ago_abortos >= 0),
    ago_metodo_anticonceptivo VARCHAR(100),
    ago_papanicolaou_fecha DATE,
    ago_mastografia_fecha DATE,
    ago_observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_historias_clinicas_paciente ON historias_clinicas(paciente_id);
