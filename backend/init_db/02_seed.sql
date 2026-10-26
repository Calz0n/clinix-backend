-- =============================================================================
-- DATOS SEMILLA (SEED DATA) CLINIX
-- =============================================================================

INSERT INTO unidades_medicas (nombre, clave_oficial, direccion, colonia, telefono, activo)
VALUES (
    'Dirección de Salud Pública Municipal - Sede Central',
    'DSPM-COATZA-01',
    'Av. Hilario Rodríguez Malpica 402, Centro',
    'Centro',
    '9212112100',
    TRUE
) ON CONFLICT (clave_oficial) DO NOTHING;

INSERT INTO usuarios (unidad_medica_id, nombre, apellidos, email, password_hash, rol, cedula_profesional, activo)
VALUES (
    1,
    'Administrador',
    'Sistema Clinix',
    'admin@clinix.coatzacoalcos.gob.mx',
    '$2b$12$e6x4i0uK0L6hKz2Kz5z5v.0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5',
    'DIRECCION',
    'ADMIN-001',
    TRUE
) ON CONFLICT (email) DO NOTHING;
