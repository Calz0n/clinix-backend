# Clinix Backend API - Actualización Integral (2026-2029)
Dirección de Salud Pública Municipal de Coatzacoalcos, Ver.

## 1. Contenido de la Actualización
Esta entrega complementa y corrige el backend en Node.js/Express y PostgreSQL para soportar al 100% el frontend de Flutter:

1. **Gestión de Personal Clínico (`/api/usuarios`):**
   - `GET /api/usuarios`: Listado de todo el personal (médicos, odontólogos, nutriólogos, psicólogos, enfermeros, directores) con datos de unidad médica.
   - `GET /api/usuarios/:id`: Detalle de usuario.
   - `POST /api/usuarios`: Alta de nuevo profesional con hash de contraseña Bcrypt (cost factor 12).
   - `PUT /api/usuarios/:id`: Actualización de datos, rol, cédula profesional y clínica asignada.
   - `PATCH /api/usuarios/:id/status` (y `/estado`): Pausar o reactivar cuenta del profesional.
   - `DELETE /api/usuarios/:id`: Baja lógica conforme a NOM-004.

2. **Catálogo de Sedes Médicas (`/api/unidades`):**
   - `GET /api/unidades`: Consulta de sedes municipales activas (Clínica Central, Villa Allende, Teresa Morales, etc.).
   - `GET /api/unidades/:id`: Detalle de sede.
   - `POST /api/unidades` y `PUT /api/unidades/:id`: Gestión administrativa de sedes.

3. **Auditoría y Trazabilidad NOM-004 (`/api/auditoria`):**
   - `GET /api/auditoria/accesos`: Registro de últimos inicios de sesión y accesos al sistema.
   - `GET /api/auditoria/expedientes`: Bitácora cronológica de consultas y notas médicas firmadas.
   - `GET /api/auditoria/resumen`: Indicadores de integridad y cumplimiento normativo NOM-004/NOM-024.

4. **Corrección de Placeholders SQL en `pacientes.routes.js`:**
   - Reparados todos los parámetros rotos en `GET /:id/historia-clinica`, `PUT /:id/historia-clinica` y `GET /:id/expediente-completo`.

5. **Canalización con Especialidad en Recepción (`atenciones.routes.js`):**
   - `POST /api/atenciones`: Soporta `area_servicio` y `tipo_atencion`.

## 2. Despliegue en Servidor (Podman / Docker)

### Opción A: Descomprimir y reiniciar contenedor
```bash
# 1. Descomprimir en la carpeta del backend
unzip -o backend-completo-actualizado.zip -d /ruta/a/clinix/backend/

# 2. Reconstruir y reiniciar con Podman
podman build -t clinix-backend -f Containerfile .
podman stop clinix-backend && podman rm clinix-backend
podman run -d --name clinix-backend -p 3000:3000 --env-file .env clinix-backend
```

### Opción B: Ejecución directa con Node.js
```bash
npm install
npm start
```
