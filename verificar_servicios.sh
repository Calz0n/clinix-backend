#!/bin/bash

# Colores para salida visual
VERDE='\033[0;32m'
ROJO='\033[0;31m'
AMARILLO='\033[1;33m'
AZUL='\033[0;34m'
SIN_COLOR='\033[0m'

echo -e "\n${AZUL}========================================================================${SIN_COLOR}"
echo -e "${AZUL}      DIAGNÓSTICO Y SALUD DEL SISTEMA CLINIX (COATZACOALCOS)           ${SIN_COLOR}"
echo -e "${AZUL}========================================================================${SIN_COLOR}\n"

# 1. Verificación de Contenedores Podman
echo -e "${AZUL}[1/6] Verificando contenedores de Podman...${SIN_COLOR}"
CONTENEDORES=("clinix_traefik" "clinix_postgres" "clinix_backend")
TODOS_OK=true

for C in "${CONTENEDORES[@]}"; do
    ESTADO=$(podman inspect -f '{{.State.Status}}' "$C" 2>/dev/null)
    if [ "$ESTADO" == "running" ]; then
        echo -e "  ✓ Contenedor [${C}]: ${VERDE}ACTIVO (running)${SIN_COLOR}"
    else
        echo -e "  ✗ Contenedor [${C}]: ${ROJO}INACTIVO o NO ENCONTRADO (${ESTADO})${SIN_COLOR}"
        TODOS_OK=false
    fi
done

# 2. Verificación de Autoinicio en Systemd
echo -e "\n${AZUL}[2/6] Verificando servicio de autoinicio (Systemd)...${SIN_COLOR}"
SYS_ACTIVO=$(systemctl is-active clinix.service 2>/dev/null)
SYS_ENABLED=$(systemctl is-enabled clinix.service 2>/dev/null)

if [ "$SYS_ENABLED" == "enabled" ]; then
    echo -e "  ✓ Inicio automático al encender VM: ${VERDE}HABILITADO (enabled)${SIN_COLOR}"
else
    echo -e "  ✗ Inicio automático al encender VM: ${ROJO}DESHABILITADO (${SYS_ENABLED})${SIN_COLOR}"
fi

if [ "$SYS_ACTIVO" == "active" ]; then
    echo -e "  ✓ Estado del servicio en Systemd: ${VERDE}ACTIVO (active)${SIN_COLOR}"
else
    echo -e "  ⚠ Estado del servicio en Systemd: ${AMARILLO}${SYS_ACTIVO}${SIN_COLOR}"
fi

# 3. Healthcheck de la API Backend
echo -e "\n${AZUL}[3/6] Verificando API Backend y conexión a PostgreSQL...${SIN_COLOR}"
HTTP_RESPONSE=$(curl -s -m 5 http://127.0.0.1:3000/api/health)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://127.0.0.1:3000/api/health)

if [ "$HTTP_CODE" == "200" ]; then
    DB_STATUS=$(echo "$HTTP_RESPONSE" | grep -o '"database":"[^"]*' | cut -d'"' -f4)
    echo -e "  ✓ Endpoint /api/health: ${VERDE}HTTP 200 OK${SIN_COLOR}"
    echo -e "  ✓ Enlace API -> PostgreSQL: ${VERDE}${DB_STATUS}${SIN_COLOR}"
else
    echo -e "  ✗ Endpoint /api/health: ${ROJO}ERROR HTTP ${HTTP_CODE}${SIN_COLOR}"
fi

# 4. Auditoría de Datos en PostgreSQL
echo -e "\n${AZUL}[4/6] Auditando registros clínicos en PostgreSQL...${SIN_COLOR}"
CONTEOS=$(podman exec -i clinix_postgres psql -U clinix_user -d clinix_db -t -c "
SELECT 'Pacientes: ' || COUNT(*) FROM pacientes
UNION ALL
SELECT 'Atenciones clínicas: ' || COUNT(*) FROM atenciones_clinicas
UNION ALL
SELECT 'Consultas médicas: ' || COUNT(*) FROM consultas_base
UNION ALL
SELECT 'Interconsultas cruzadas: ' || COUNT(*) FROM tratamientos_cruzados;
" 2>/dev/null)

if [ $? -eq 0 ]; then
    while IFS= read -r linea; do
        if [ ! -z "$linea" ]; then
            echo -e "  ✓ $linea"
        fi
    done <<< "$CONTEOS"
else
    echo -e "  ✗ ${ROJO}No se pudo consultar PostgreSQL.${SIN_COLOR}"
fi

# 5. Estado de Respaldos de Seguridad
echo -e "\n${AZUL}[5/6] Verificando respaldos automáticos...${SIN_COLOR}"
DIR_BACKUPS="/root/clinix/backups"
ULTIMO_BACKUP=$(ls -t "$DIR_BACKUPS"/clinix_backup_*.sql.gz 2>/dev/null | head -n 1)

if [ -f "$ULTIMO_BACKUP" ]; then
    TAM_BKP=$(du -h "$ULTIMO_BACKUP" | cut -f1)
    FECHA_BKP=$(stat -c '%y' "$ULTIMO_BACKUP" | cut -d'.' -f1)
    TOTAL_BKPS=$(ls -1 "$DIR_BACKUPS"/clinix_backup_*.sql.gz 2>/dev/null | wc -l)
    echo -e "  ✓ Último respaldo: ${VERDE}$(basename "$ULTIMO_BACKUP")${SIN_COLOR}"
    echo -e "    - Fecha: $FECHA_BKP | Tamaño: $TAM_BKP"
    echo -e "    - Total respaldos almacenados: $TOTAL_BKPS"
else
    echo -e "  ⚠ ${AMARILLO}No se encontraron respaldos en $DIR_BACKUPS${SIN_COLOR}"
fi

# 6. Monitoreo de Recursos del Servidor
echo -e "\n${AZUL}[6/6] Monitoreo de recursos del servidor...${SIN_COLOR}"
IP_ACTIVA=$(hostname -I | awk '{print $1}')
DISCO_USO=$(df -h / | awk 'NR==2 {print $5 " (" $3 " usado de " $2 ")"}')
RAM_USO=$(free -h | awk 'NR==2 {print $3 " usados de " $2}')

echo -e "  ✓ IP de Red Local: ${VERDE}${IP_ACTIVA}${SIN_COLOR}"
echo -e "  ✓ Espacio en Disco (/): ${VERDE}${DISCO_USO}${SIN_COLOR}"
echo -e "  ✓ Memoria RAM: ${VERDE}${RAM_USO}${SIN_COLOR}"

echo -e "\n${AZUL}========================================================================${SIN_COLOR}"
if [ "$TODOS_OK" = true ] && [ "$HTTP_CODE" == "200" ]; then
    echo -e "  ${VERDE}ESTADO GENERAL: TODOS LOS SERVICIOS OPERAN CORRECTAMENTE${SIN_COLOR}"
else
    echo -e "  ${ROJO}ESTADO GENERAL: SE DETECTARON PROBLEMAS EN EL SISTEMA${SIN_COLOR}"
fi
echo -e "${AZUL}========================================================================${SIN_COLOR}\n"
