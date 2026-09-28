-- =============================================================================
-- SISTEMA CLINIX: ESQUEMA DE BASE DE DATOS RELACIONAL (POSTGRESQL 16)
-- Dirección de Salud Pública Municipal de Coatzacoalcos, Ver.
-- Cumplimiento: NOM-004-SSA3-2012 y LGPDPPSO
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ADMINISTRACIÓN, SEGURIDAD Y SEDES
CREATE TABLE IF NOT EXISTS unidades_medicas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    clave_oficial VARCHAR(20) UNIQUE NOT NULL,
    direccion VARCHAR(250) NOT NULL,
    colonia VARCHAR(100) NOT NULL,
    telefono VARCHAR(15),
    georreferencia VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    unidad_medica_id INT NOT NULL REFERENCES unidades_medicas(id) ON DELETE RESTRICT,
    nombre VARCHAR(80) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL CHECK (
        rol IN ('RECEPCION', 'ENFERMERIA', 'MEDICO_GENERAL', 'ODONTOLOGO', 'NUTRIOLOGO', 'PSICOLOGO', 'DIRECCION')
    ),
    cedula_profesional VARCHAR(25),
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    ultimo_acceso TIMESTAMP
);

-- 2. RECEPCIÓN Y EXPEDIENTE ÚNICO
CREATE TABLE IF NOT EXISTS pacientes (
    id SERIAL PRIMARY KEY,
    unidad_medica_id INT NOT NULL REFERENCES unidades_medicas(id) ON DELETE RESTRICT,
    numero_expediente VARCHAR(30) UNIQUE NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    nombres VARCHAR(80) NOT NULL,
    apellido_paterno VARCHAR(60) NOT NULL,
    apellido_materno VARCHAR(60),
    curp VARCHAR(18) UNIQUE NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    sexo CHAR(1) NOT NULL CHECK (sexo IN ('M', 'F')),
    estado_civil VARCHAR(25),
    escolaridad VARCHAR(40),
    calle_numero VARCHAR(150) NOT NULL,
    colonia VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(5),
    telefono VARCHAR(15),
    derechohabiencia VARCHAR(50) NOT NULL CHECK (
        derechohabiencia IN ('IMSS', 'ISSSTE', 'PEMEX', 'SEDENA', 'SEMAR', 'IMSS-Bienestar', 'Ninguna')
    ),
    enfermedades_previas TEXT,
    beneficiario_programa BOOLEAN DEFAULT FALSE NOT NULL,
    nombre_programa VARCHAR(100),
    num_personas_vivienda SMALLINT DEFAULT 1 NOT NULL CHECK (num_personas_vivienda >= 1)
);

CREATE TABLE IF NOT EXISTS tutores (
    id SERIAL PRIMARY KEY,
    paciente_id INT UNIQUE NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(150) NOT NULL,
    parentesco VARCHAR(40) NOT NULL CHECK (
        parentesco IN ('Madre', 'Padre', 'Tutor Legal', 'Abuelo/a', 'Otro')
    ),
    telefono_contacto VARCHAR(15) NOT NULL,
    tipo_identificacion VARCHAR(50) NOT NULL,
    numero_identificacion VARCHAR(50)
);

-- 3. TRIAJE Y FLUJO CLÍNICO
CREATE TABLE IF NOT EXISTS atenciones_clinicas (
    id SERIAL PRIMARY KEY,
    paciente_id INT NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    unidad_medica_id INT NOT NULL REFERENCES unidades_medicas(id) ON DELETE RESTRICT,
    usuario_recepcion_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_hora_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tipo_atencion VARCHAR(20) NOT NULL CHECK (tipo_atencion IN ('PRIMERA_VEZ', 'SUBSECUENTE')),
    estado VARCHAR(30) NOT NULL CHECK (estado IN ('RECEPCION', 'TRIAJE', 'EN_CONSULTA', 'FINALIZADA'))
);

CREATE TABLE IF NOT EXISTS triaje_signos_vitales (
    id SERIAL PRIMARY KEY,
    atencion_id INT UNIQUE NOT NULL REFERENCES atenciones_clinicas(id) ON DELETE CASCADE,
    enfermero_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tension_arterial VARCHAR(15) NOT NULL,
    frecuencia_cardiaca SMALLINT NOT NULL CHECK (frecuencia_cardiaca > 0),
    frecuencia_respiratoria SMALLINT NOT NULL CHECK (frecuencia_respiratoria > 0),
    temperatura NUMERIC(4,1) NOT NULL CHECK (temperatura BETWEEN 30.0 AND 45.0),
    saturacion_oxigeno SMALLINT NOT NULL CHECK (saturacion_oxigeno BETWEEN 0 AND 100),
    glucosa_capilar SMALLINT CHECK (glucosa_capilar > 0),
    peso_kg NUMERIC(5,2) NOT NULL CHECK (peso_kg > 0),
    talla_metros NUMERIC(3,2) NOT NULL CHECK (talla_metros > 0),
    imc NUMERIC(4,1) NOT NULL,
    clasificacion_imc VARCHAR(30) NOT NULL,
    detecciones_riesgo TEXT,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS procedimientos_enfermeria (
    id SERIAL PRIMARY KEY,
    triaje_id INT NOT NULL REFERENCES triaje_signos_vitales(id) ON DELETE CASCADE,
    tipo_procedimiento VARCHAR(50) NOT NULL,
    cantidad SMALLINT DEFAULT 1 NOT NULL CHECK (cantidad > 0),
    observaciones VARCHAR(200)
);

-- 4. CONSULTAS Y ESPECIALIDADES MÉDICAS
CREATE TABLE IF NOT EXISTS consultas_base (
    id SERIAL PRIMARY KEY,
    atencion_id INT NOT NULL REFERENCES atenciones_clinicas(id) ON DELETE RESTRICT,
    especialista_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    area_medica VARCHAR(30) NOT NULL CHECK (
        area_medica IN ('MEDICINA_GENERAL', 'ODONTOLOGIA', 'NUTRICION', 'PSICOLOGIA')
    ),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    motivo_consulta TEXT NOT NULL,
    observaciones TEXT
);

CREATE TABLE IF NOT EXISTS consultas_medicina_general (
    id SERIAL PRIMARY KEY,
    consulta_id INT UNIQUE NOT NULL REFERENCES consultas_base(id) ON DELETE CASCADE,
    nota_subjetivo TEXT NOT NULL,
    nota_objetivo TEXT NOT NULL,
    nota_analisis TEXT NOT NULL,
    nota_plan TEXT NOT NULL,
    diagnostico_cie10 VARCHAR(10) NOT NULL,
    diagnostico_descripcion VARCHAR(200) NOT NULL,
    clasificacion_morbilidad VARCHAR(60) NOT NULL,
    pruebas_rapidas VARCHAR(150),
    canalizacion_externa VARCHAR(60),
    emite_certificado BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE IF NOT EXISTS consultas_odontologia (
    id SERIAL PRIMARY KEY,
    consulta_id INT UNIQUE NOT NULL REFERENCES consultas_base(id) ON DELETE CASCADE,
    tipo_denticion VARCHAR(20) NOT NULL CHECK (tipo_denticion IN ('ADULTA', 'INFANTIL')),
    comorbilidades_bucales TEXT,
    estudios_gabinete VARCHAR(150),
    indice_cpod SMALLINT DEFAULT 0 NOT NULL,
    indice_ceod SMALLINT DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS piezas_dentales (
    id SERIAL PRIMARY KEY,
    consulta_odontologia_id INT NOT NULL REFERENCES consultas_odontologia(id) ON DELETE CASCADE,
    numero_fdi SMALLINT NOT NULL,
    cara_vestibular VARCHAR(15) DEFAULT 'SANO' CHECK (cara_vestibular IN ('SANO', 'CARIES', 'RESINA', 'AMALGAMA')),
    cara_lingual VARCHAR(15) DEFAULT 'SANO' CHECK (cara_lingual IN ('SANO', 'CARIES', 'RESINA', 'AMALGAMA')),
    cara_mesial VARCHAR(15) DEFAULT 'SANO' CHECK (cara_mesial IN ('SANO', 'CARIES', 'RESINA', 'AMALGAMA')),
    cara_distal VARCHAR(15) DEFAULT 'SANO' CHECK (cara_distal IN ('SANO', 'CARIES', 'RESINA', 'AMALGAMA')),
    cara_oclusal VARCHAR(15) DEFAULT 'SANO' CHECK (cara_oclusal IN ('SANO', 'CARIES', 'RESINA', 'AMALGAMA')),
    estado_general VARCHAR(25) DEFAULT 'NORMAL' CHECK (estado_general IN ('NORMAL', 'EXTRACCION', 'AUSENTE')),
    en_puente_fijo BOOLEAN DEFAULT FALSE NOT NULL,
    tiene_protesis_corona BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE IF NOT EXISTS consultas_nutricion (
    id SERIAL PRIMARY KEY,
    consulta_id INT UNIQUE NOT NULL REFERENCES consultas_base(id) ON DELETE CASCADE,
    circunferencia_cintura NUMERIC(5,1),
    circunferencia_cadera NUMERIC(5,1),
    circunferencia_brazo NUMERIC(4,1),
    porcentaje_grasa NUMERIC(4,1),
    porcentaje_musculo NUMERIC(4,1),
    consumo_agua_litros NUMERIC(3,1),
    frecuencia_ejercicio VARCHAR(60),
    recordatorio_24h JSONB
);

CREATE TABLE IF NOT EXISTS curvas_crecimiento_oms (
    id SERIAL PRIMARY KEY,
    consulta_nutricion_id INT UNIQUE NOT NULL REFERENCES consultas_nutricion(id) ON DELETE CASCADE,
    rango_edad_oms VARCHAR(20) NOT NULL CHECK (rango_edad_oms IN ('2_A_5_ANOS', '5_A_19_ANOS')),
    zscore_peso_edad NUMERIC(4,2),
    zscore_talla_edad NUMERIC(4,2),
    zscore_imc_edad NUMERIC(4,2),
    percentil_calculado SMALLINT
);

CREATE TABLE IF NOT EXISTS consultas_psicologia (
    id SERIAL PRIMARY KEY,
    consulta_id INT UNIQUE NOT NULL REFERENCES consultas_base(id) ON DELETE CASCADE,
    evaluacion_clinica TEXT NOT NULL,
    nota_evolucion TEXT NOT NULL,
    plan_intervencion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consentimientos_informados (
    id SERIAL PRIMARY KEY,
    consulta_id INT NOT NULL REFERENCES consultas_base(id) ON DELETE CASCADE,
    paciente_id INT NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    tutor_id INT REFERENCES tutores(id) ON DELETE RESTRICT,
    grupo_edad VARCHAR(20) NOT NULL CHECK (grupo_edad IN ('INFANTIL', 'ADOLESCENTE', 'ADULTO')),
    texto_legal TEXT NOT NULL,
    firmado BOOLEAN DEFAULT FALSE NOT NULL,
    fecha_firma TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS tratamientos_cruzados (
    id SERIAL PRIMARY KEY,
    atencion_origen_id INT NOT NULL REFERENCES atenciones_clinicas(id) ON DELETE RESTRICT,
    area_origen VARCHAR(30) NOT NULL,
    area_destino VARCHAR(30) NOT NULL CHECK (
        area_destino IN ('MEDICINA_GENERAL', 'ODONTOLOGIA', 'NUTRICION', 'PSICOLOGIA')
    ),
    prioridad VARCHAR(15) DEFAULT 'NORMAL' NOT NULL CHECK (prioridad IN ('NORMAL', 'URGENTE')),
    motivo_derivacion TEXT NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE' NOT NULL CHECK (estado IN ('PENDIENTE', 'ATENDIDO', 'CANCELADO')),
    fecha_hora_derivacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. PRODUCTIVIDAD Y CONTROL ESTADÍSTICO
CREATE TABLE IF NOT EXISTS bitacora_productividad_diaria (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    unidad_medica_id INT NOT NULL REFERENCES unidades_medicas(id) ON DELETE RESTRICT,
    fecha DATE NOT NULL,
    total_atenciones INT DEFAULT 0 NOT NULL,
    desglose_servicios JSONB,
    CONSTRAINT uq_bitacora_usuario_fecha UNIQUE (usuario_id, fecha)
);

CREATE TABLE IF NOT EXISTS reportes_estadisticos_mensuales (
    id SERIAL PRIMARY KEY,
    unidad_medica_id INT NOT NULL REFERENCES unidades_medicas(id) ON DELETE RESTRICT,
    mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio SMALLINT NOT NULL CHECK (anio >= 2024),
    total_consultas INT NOT NULL,
    total_primeras_veces INT NOT NULL,
    total_subsecuentes INT NOT NULL,
    desglose_sexo JSONB NOT NULL,
    desglose_grupos_edad JSONB NOT NULL,
    desglose_morbilidad JSONB NOT NULL,
    cuadre_valido BOOLEAN DEFAULT TRUE NOT NULL,
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_reporte_unidad_periodo UNIQUE (unidad_medica_id, mes, anio)
);

-- ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_pacientes_curp ON pacientes(curp);
CREATE INDEX IF NOT EXISTS idx_pacientes_expediente ON pacientes(numero_expediente);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON pacientes(apellido_paterno, apellido_materno, nombres);
CREATE INDEX IF NOT EXISTS idx_atenciones_paciente_fecha ON atenciones_clinicas(paciente_id, fecha_hora_ingreso DESC);
CREATE INDEX IF NOT EXISTS idx_atenciones_estado ON atenciones_clinicas(estado);
CREATE INDEX IF NOT EXISTS idx_consultas_base_atencion ON consultas_base(atencion_id);
CREATE INDEX IF NOT EXISTS idx_piezas_dentales_consulta ON piezas_dentales(consulta_odontologia_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora_productividad_diaria(fecha);
CREATE INDEX IF NOT EXISTS idx_reportes_periodo ON reportes_estadisticos_mensuales(anio, mes);
