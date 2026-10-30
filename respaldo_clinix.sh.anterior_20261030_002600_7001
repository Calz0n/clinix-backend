#!/bin/bash

# Configuración del respaldo
DIR_RESPALDOS="/root/clinix/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVO_RESPALDO="$DIR_RESPALDOS/clinix_backup_$TIMESTAMP.sql.gz"
LOG_FILE="$DIR_RESPALDOS/respaldos.log"
RETENCION_DIAS=30

# Crear directorio de respaldos si no existe
mkdir -p "$DIR_RESPALDOS"

echo "==================================================" >> "$LOG_FILE"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Iniciando respaldo de Clinix..." >> "$LOG_FILE"

# Ejecutar pg_dump dentro del contenedor de PostgreSQL y comprimir al vuelo
podman exec -i clinix_postgres pg_dump -U clinix_user -d clinix_db | gzip > "$ARCHIVO_RESPALDO"

# Verificar si el archivo se generó correctamente y no está vacío
if [ -s "$ARCHIVO_RESPALDO" ]; then
    TAMANIO=$(du -h "$ARCHIVO_RESPALDO" | cut -f1)
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Respaldo generado con éxito: $ARCHIVO_RESPALDO (Tamaño: $TAMANIO)" >> "$LOG_FILE"
    echo "✓ Respaldo completado: $ARCHIVO_RESPALDO ($TAMANIO)"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: El archivo de respaldo está vacío o falló la exportación." >> "$LOG_FILE"
    echo "✗ Error: El respaldo falló."
    exit 1
fi

# Eliminar respaldos más antiguos que la política de retención (30 días)
find "$DIR_RESPALDOS" -name "clinix_backup_*.sql.gz" -type f -mtime +$RETENCION_DIAS -delete
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Política de retención aplicada (antigüedad máxima: $RETENCION_DIAS días)." >> "$LOG_FILE"

echo "==================================================" >> "$LOG_FILE"
