# MEMORIA TÉCNICA Y ESPECIFICACIÓN FORMAL DE SOFTWARE
## Sistema Web de Gestión Clínica y Control Estadístico Municipal (Clinix)

* **Institución Beneficiaria:** Dirección de Salud Pública Municipal del H. Ayuntamiento de Coatzacoalcos, Veracruz (Administración 2026-2029).
* **Entidad Académica:** Universidad Veracruzana — Facultad de Ingeniería, Campus Coatzacoalcos.
* **Fecha de Emisión:** Septiembre de 2026.
* **Versión:** 1.0 (Línea Base del Backend e Infraestructura).

---

### ÍNDICE GENERAL
1. **Introducción y Justificación Social**
2. **Marco Normativo y Regulatorio en Salud**
3. **Especificación de Requisitos del Sistema (IEEE 830 / ISO/IEC 29148)**
4. **Arquitectura Tecnológica e Infraestructura de Servidor**
5. **Modelo de Base de Datos y Optimización Relacional**
6. **Módulos Clínicos Especializados y Reglas de Negocio**
7. **Motor Estadístico, Reportes Oficiales y Cierre Mensual**
8. **Políticas de Seguridad, Respaldo y Recuperación ante Desastres**
9. **Resultados de Pruebas Empíricas de Rendimiento**
10. **Conclusiones y Trabajo Futuro**

---

### CAPÍTULO 1: INTRODUCCIÓN Y JUSTIFICACIÓN SOCIAL
La Dirección de Salud Pública Municipal de Coatzacoalcos brinda atención ambulatoria de primer nivel a población abierta y trabajadores municipales. Históricamente, el control de pacientes se realizaba mediante carpetas de papel y libretas manuscritas, provocando:
* Dispersión de antecedentes clínicos y pérdida de continuidad terapéutica.
* Retrasos de varios días a fin de mes para el conteo manual de consultas en hojas tabulares.
* Vulnerabilidad en la custodia de datos personales sensibles de salud.

**Clinix** nace como una solución de ingeniería de software para digitalizar el flujo clínico continuo: Recepción → Triaje de Enfermería → Consultorios de Especialidad → Dirección y Control Estadístico.

---

### CAPÍTULO 2: MARCO NORMATIVO Y REGULATORIO
El sistema se construyó bajo estricto apego a las normas oficiales mexicanas:
1. **NOM-004-SSA3-2012 (Del Expediente Clínico):**
   * Estructuración obligatoria de notas de evolución (formato SOAP: Subjetivo, Objetivo, Análisis y Plan).
   * Identificación del personal de salud (nombre y cédula profesional).
   * Firma obligatoria y resguardo de Consentimientos Informados diferenciados para pacientes pediátricos, adolescentes y adultos.
2. **NOM-024-SSA3-2012 (Sistemas de Registro Electrónico para la Salud):**
   * Integridad, trazabilidad y confidencialidad en el intercambio de información clínica.
3. **LGPDPPSO (Ley General de Protección de Datos Personales):**
   * Custodia criptográfica y control de acceso estricto basado en roles (RBAC) para salvaguardar información sensible.

---

### CAPÍTULO 3: ESPECIFICACIÓN DE REQUISITOS (ERS)
* **RF-01 (Búsqueda Indexada):** Localización de expedientes en tiempo real por CURP, nombre o folio en `< 3.0 segundos` (Superado con `52.5 ms` promedio).
* **RF-01.1 (Protección de Menores):** Bloqueo mandatorio del guardado si un paciente menor de 18 años carece de los datos completos de su tutor legal (*Madre, Padre, Tutor Legal, Abuelo/a, Otro*).
* **RF-02 (Triaje y Semáforo de Riesgo):** Captura de somatometría, cálculo automático de IMC y semaforización clínica en tres niveles:
  * *Verde:* Signos vitales normales.
  * *Amarillo:* Parámetros limítrofes / alteración moderada.
  * *Rojo:* Alerta clínica crítica (ej. Crisis Hipertensiva T/A >= 180/110, Sat O2 < 90%).
* **RF-03 (Consultorios y Especialidades):**
  * *Medicina General:* Formato SOAP y catálogo diagnóstico CIE-10.
  * *Odontología:* Odontograma con nomenclatura internacional FDI (32 adultos / 20 niños) y cálculo automático del índice CPO-D y CEO-D.
  * *Nutrición:* Evaluación de IMC, Relación Cintura-Cadera (RCC), recordatorio de 24 horas (JSONB) y percentiles OMS.
  * *Psicología:* Notas de intervención terapéutica y consentimiento legal.
* **RF-04 (Tratamientos Cruzados):** Derivación de interconsultas inmediatas entre especialidades con priorización de urgencias dentro del mismo turno.
* **RF-05 (Motor Estadístico Oficial):** Generación automática de Hojas Diarias por área y Concentrado Mensual con cuadre matemático obligatorio y exportación dual (PDF membretado y Excel nativo `.xls`).

---

### CAPÍTULO 4: ARQUITECTURA TECNOLÓGICA E INFRAESTRUCTURA
* **Sistema Operativo Base:** AlmaLinux 10 / RHEL 10 (Linux Enterprise).
* **Virtualización y Contenedores:** Podman (>= 5.0) en arquitectura rootless/contenedores aislados bajo red puente local (`172.16.50.148`).
* **Servidor Web y Proxy Inverso:** Traefik v3.1 (enrutamiento de rutas `/api` en puerto 80).
* **Backend:** Node.js v20 LTS con arquitectura modular en Express.js.
* **Base de Datos:** PostgreSQL 16 Alpine con transacciones ACID completas.
* **Gestor de Inicio:** `systemd` (`clinix.service`) para arranque automático en segundo plano ante reinicios del servidor.

---

### CAPÍTULO 5: MODELO DE BASE DE DATOS Y OPTIMIZACIÓN
PostgreSQL implementa índices B-Tree específicos para garantizar alta concurrencia:
* `idx_pacientes_curp` y `idx_pacientes_expediente`: Búsquedas en `0.32 ms` con `shared hit=2` en memoria RAM.
* `idx_piezas_dentales_consulta`: Unión de 3 tablas del odontograma y ordenamiento de 32 piezas en `7.09 ms`.
* Integridad referencial con restricciones `CHECK` para roles de usuario, tipos de dentición, parentescos y cuadrantes FDI.

---

### CAPÍTULO 6: RESULTADOS DE RENDIMIENTO Y CONCLUSIONES
* **Prueba de Carga Multiusuario:** 100 peticiones concurrentes completadas con 0% de fallos a una tasa superior a 50 peticiones/segundo con latencia promedio de ~50 ms.
* **Operatividad Municipal:** Se eliminó por completo el conteo manual de hojas a fin de mes, generando los formatos oficiales exigidos por el Ayuntamiento de Coatzacoalcos en 1 solo clic.
