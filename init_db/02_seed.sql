-- =============================================================================
-- DATOS SEMILLA (SEED DATA) CLINIX
-- Dirección de Salud Pública Municipal de Coatzacoalcos, Ver.
-- Contraseña Universal para todos los usuarios de prueba: clinix123
-- =============================================================================

-- 1. UNIDAD MÉDICA PRINCIPAL
INSERT INTO unidades_medicas (id, nombre, clave_oficial, direccion, colonia, telefono, activo)
VALUES (
    1,
    'Dirección de Salud Pública Municipal - Sede Central',
    'DSPM-COATZA-01',
    'Av. Hilario Rodríguez Malpica 402, Centro',
    'Centro',
    '9212112100',
    TRUE
) ON CONFLICT (clave_oficial) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    direccion = EXCLUDED.direccion,
    telefono = EXCLUDED.telefono;

-- Ajustar secuencia de unidades médicas
SELECT setval('unidades_medicas_id_seq', (SELECT COALESCE(MAX(id), 1) FROM unidades_medicas));

-- 2. USUARIOS Y PERFILES CLÍNICOS DE PRUEBA (7 ROLES)
-- Hash Bcrypt verificado para "clinix123" con 12 salt rounds:
-- $2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG

-- 2.1 Recepción
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'María Elena',
    'Cruz Santos',
    'recepcion@clinix.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'RECEPCION',
    'REC-101',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- 2.2 Enfermería
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'Lic. Sofía',
    'Mendoza Ramos',
    'enfermeria@clinix.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'ENFERMERIA',
    'ENF-202',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- 2.3 Medicina General
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'Dr. Carlos',
    'Gómez Herrera',
    'medico@clinix.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'MEDICO_GENERAL',
    'MED-303',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- 2.4 Odontología
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'Dra. Brenda',
    'Castillo Lara',
    'odonto@clinix.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'ODONTOLOGO',
    'ODO-404',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- 2.5 Nutrición
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'L.N. Daniela',
    'Peralta Silva',
    'nutri@clinix.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'NUTRIOLOGO',
    'NUT-505',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- 2.6 Psicología
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'Psic. Jorge',
    'Morales Díaz',
    'psico@clinix.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'PSICOLOGO',
    'PSI-606',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- 2.7 Dirección y Supervisión
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'Dr. Roberto',
    'Alor Vázquez',
    'admin@clinix.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'DIRECCION',
    'DIR-001',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- Usuario de respaldo administrativo
INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'Administrador',
    'Sistema Clinix',
    'admin@clinix.coatzacoalcos.gob.mx',
    '$2b$12$5CEXr1S6jAjsgscParfx3.j2fmyYM.ycQtKnsxJIh0qVDqz/qyIOG',
    'DIRECCION',
    'ADMIN-001',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    activo = TRUE;

-- Sincronizar secuencia de usuarios
SELECT setval('usuarios_id_seq', (SELECT COALESCE(MAX(id), 1) FROM usuarios));
