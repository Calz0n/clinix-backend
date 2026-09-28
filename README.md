# Clinix - Entorno de Desarrollo Contenerizado (Podman)
Dirección de Salud Pública Municipal de Coatzacoalcos, Ver.

## Requisitos
- AlmaLinux 10 / RHEL 10
- Podman (>= 5.0) y podman-compose

## Instrucciones de Inicio Rápido
1. Levantar la pila de contenedores:
   ```bash
   podman compose up -d
   ```
2. Verificar el estado de los contenedores:
   ```bash
   podman ps
   ```
3. Probar la API y la conexión a PostgreSQL:
   ```bash
   curl http://localhost/api/health
   curl http://localhost/api/unidades
   ```
