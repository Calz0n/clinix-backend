#!/bin/bash
# PostgreSQL de Clinix: SQL comprimido, publicación atómica y errores comprobados.
set -Eeuo pipefail
umask 077

DIR_RESPALDOS="${CLINIX_BACKUP_DIR:-/root/clinix/backups}"
PG_CONTENEDOR="${CLINIX_PG_CONTAINER:-clinix_postgres}"
DB_USUARIO="${CLINIX_DB_USER:-clinix_user}"
DB_NOMBRE="${CLINIX_DB_NAME:-clinix_db}"
RETENCION_DIAS="${CLINIX_RETENCION_DIAS:-30}"
ESPERA_SEGUNDOS="${CLINIX_BACKUP_WAIT_SECONDS:-300}"
INTERVALO_SEGUNDOS="${CLINIX_BACKUP_POLL_SECONDS:-5}"
ESPERA_BLOQUEO="${CLINIX_BACKUP_LOCK_SECONDS:-60}"

for valor in "$RETENCION_DIAS" "$ESPERA_SEGUNDOS" "$INTERVALO_SEGUNDOS" "$ESPERA_BLOQUEO"; do
    if [[ ! "$valor" =~ ^[0-9]{1,6}$ ]]; then
        echo 'ERROR: Los tiempos y la retención deben ser números enteros.' >&2
        exit 1
    fi
done
if (( RETENCION_DIAS < 1 || INTERVALO_SEGUNDOS < 1 )); then
    echo 'ERROR: La retención y el intervalo deben ser mayores que cero.' >&2
    exit 1
fi

for programa in podman timeout gzip awk flock find mktemp tee date du mv; do
    command -v "$programa" >/dev/null || { echo "ERROR: Falta $programa." >&2; exit 1; }
done
mkdir -p -- "$DIR_RESPALDOS"
chmod 700 -- "$DIR_RESPALDOS"
LOG_FILE="$DIR_RESPALDOS/respaldos.log"
TEMPORAL=''
PUBLICADO=0

log() {
    printf '[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE"
}
limpiar() {
    local resultado=$?
    trap - EXIT
    if [[ -n "$TEMPORAL" ]]; then rm -f -- "$TEMPORAL" || true; fi
    if (( resultado != 0 )); then
        if (( PUBLICADO == 1 )); then
            log "ERROR posterior a generar $ARCHIVO_RESPALDO (código $resultado); la copia publicada permanece." >&2 || true
        else
            log "ERROR: El respaldo terminó con código $resultado; no se publicó una copia exitosa nueva." >&2 || true
        fi
    fi
    exit "$resultado"
}
trap limpiar EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

exec 9>"$DIR_RESPALDOS/.respaldo_clinix.lock"
if ! flock -w "$ESPERA_BLOQUEO" 9; then
    log 'ERROR: Ya hay otro respaldo en ejecución. Se reintentará mediante el servicio.' >&2
    exit 1
fi

log "Iniciando respaldo de $DB_NOMBRE. Esperando PostgreSQL..."
LIMITE=$((SECONDS + ESPERA_SEGUNDOS))
while ! timeout 15s podman exec "$PG_CONTENEDOR" pg_isready -U "$DB_USUARIO" -d "$DB_NOMBRE" -t 5 >/dev/null 2>&1; do
    if (( SECONDS >= LIMITE )); then
        log "ERROR: PostgreSQL no está disponible en $PG_CONTENEDOR." >&2
        exit 1
    fi
    sleep "$INTERVALO_SEGUNDOS"
done

TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
ARCHIVO_RESPALDO="$DIR_RESPALDOS/clinix_backup_${TIMESTAMP}_${BASHPID}.sql.gz"
TEMPORAL=$(mktemp "$DIR_RESPALDOS/.clinix_backup_${TIMESTAMP}_XXXXXX.part")

# pipefail detecta el fallo de pg_dump aunque gzip haya creado una cabecera válida.
if ! podman exec "$PG_CONTENEDOR" pg_dump -U "$DB_USUARIO" -d "$DB_NOMBRE" 2>>"$LOG_FILE" | gzip -c >"$TEMPORAL"; then
    log 'ERROR: Falló pg_dump o la compresión. Revisa este log.' >&2
    exit 1
fi

# La descompresión verifica la integridad gzip; awk exige contenido no vacío.
if ! gzip -dc -- "$TEMPORAL" 2>>"$LOG_FILE" | awk 'NF { contenido = 1 } END { exit !contenido }'; then
    log 'ERROR: El archivo está vacío, incompleto o dañado.' >&2
    exit 1
fi
if [[ -e "$ARCHIVO_RESPALDO" ]]; then
    log 'ERROR: Ya existe un archivo con el mismo nombre; no se sobrescribirá.' >&2
    exit 1
fi
mv -- "$TEMPORAL" "$ARCHIVO_RESPALDO"
TEMPORAL=''
PUBLICADO=1
TAMANIO=$(du -h -- "$ARCHIVO_RESPALDO" | awk '{print $1}')
log "RESPALDO COMPLETADO: $ARCHIVO_RESPALDO ($TAMANIO)."

# Misma política de retención original; sólo después de completar una copia nueva.
if find "$DIR_RESPALDOS" -maxdepth 1 -type f -name 'clinix_backup_*.sql.gz' \
    ! -path "$ARCHIVO_RESPALDO" -mtime +"$RETENCION_DIAS" -delete; then
    log "Retención aplicada: respaldos con antigüedad mayor a $RETENCION_DIAS días."
else
    log 'ADVERTENCIA: La copia se completó, pero no se pudo completar la limpieza por retención.' >&2
fi
