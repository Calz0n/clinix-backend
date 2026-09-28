# Guía de Integración Backend & Frontend — Clinix
**Dirección de Salud Pública Municipal de Coatzacoalcos, Ver.**

### 1. Conexión de Red
* **URL Base de la API:** `http://172.16.50.148:3000/api`
* **Vía Proxy Traefik:** `http://172.16.50.148/api`
* **Healthcheck:** `GET http://172.16.50.148:3000/api/health`

### 2. Colección de Postman
En la raíz de este repositorio se encuentra el archivo `clinix_postman_collection.json`. Impórtalo en Postman o Thunder Client para tener todas las peticiones listas.

### 3. Cuentas de Acceso (Contraseña universal: "clinix123")
* **Recepción:** `recepcion@clinix.gob.mx` (Búsqueda y alta de pacientes)
* **Enfermería:** `enfermeria@clinix.gob.mx` (Triaje y constantes vitales)
* **Medicina General:** `medico@clinix.gob.mx` (Notas SOAP y CIE-10)
* **Odontología:** `odonto@clinix.gob.mx` (Odontograma FDI y CPO-D)
* **Nutrición:** `nutri@clinix.gob.mx` (Curvas OMS y recordatorio 24h)
* **Psicología:** `psico@clinix.gob.mx` (Notas y consentimientos legales)
* **Dirección:** `admin@clinix.gob.mx` (Reportes, PDF, Excel y Cierre Mensual)

### 4. Manejo del Token JWT
1. Enviar `POST /api/auth/login` con correo y contraseña.
2. Guardar el `token` en almacenamiento local de la app.
3. Adjuntar en el encabezado de cada petición protegida:
   `Authorization: Bearer <TOKEN>`

### 5. Regla Crítica de Menores (RF-01.1)
Si el paciente tiene menos de 18 años, es obligatorio enviar el objeto `tutor`:
* `nombre_completo`, `parentesco` (Madre, Padre, Tutor Legal, Abuelo/a, Otro), `telefono_contacto`, `tipo_identificacion`.
