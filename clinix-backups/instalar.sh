#!/bin/bash
set -Eeuo pipefail
umask 077

ORIGEN=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Prefijo opcional exclusivamente para las pruebas aisladas del instalador.
PREFIJO="${CLINIX_INSTALL_ROOT:-}"
if [[ -n "$PREFIJO" && "$PREFIJO" != /* ]]; then
    echo 'ERROR: El prefijo de pruebas debe ser absoluto.' >&2; exit 1
fi
DESTINO="${PREFIJO}/root/clinix"
UNIDADES="${PREFIJO}/etc/systemd/system"
if [[ "$(id -u)" != 0 ]]; then
    echo 'Ejecuta este instalador como root, igual que tu despliegue Podman.' >&2; exit 1
fi
for programa in podman timeout flock gzip awk find mktemp tee date du install systemctl systemd-analyze crontab; do
    command -v "$programa" >/dev/null || { echo "ERROR: Falta $programa." >&2; exit 1; }
done
bash -n "$ORIGEN/respaldo_clinix.sh"
mkdir -p -- "$DESTINO" "$UNIDADES"
FECHA=$(date +'%Y%m%d_%H%M%S')_$$
CRON_ANTERIOR="$DESTINO/crontab_antes_respaldo_${FECHA}.txt"
ERROR_CRON=$(mktemp)
CRON_ACTUAL=$(mktemp)
CRON_NUEVO=$(mktemp)
trap 'rm -f -- "$ERROR_CRON" "$CRON_ACTUAL" "$CRON_NUEVO"' EXIT

leer_cron() {
    if LC_ALL=C crontab -l >"$1" 2>"$ERROR_CRON"; then return 0; fi
    if grep -q 'no crontab for' "$ERROR_CRON"; then : >"$1"; return 0; fi
    cat "$ERROR_CRON" >&2
    return 1
}
leer_cron "$CRON_ANTERIOR"
if [[ -f "$DESTINO/respaldo_clinix.sh" ]]; then
    cp -p -- "$DESTINO/respaldo_clinix.sh" "$DESTINO/respaldo_clinix.sh.anterior_${FECHA}"
fi
for nombre in clinix-backup.service clinix-backup.timer; do
    if [[ -f "$UNIDADES/$nombre" ]]; then
        cp -p -- "$UNIDADES/$nombre" "$DESTINO/${nombre}.anterior_${FECHA}"
    fi
done
install -m 700 "$ORIGEN/respaldo_clinix.sh" "$DESTINO/respaldo_clinix.sh"
install -m 644 "$ORIGEN/clinix-backup.service" "$UNIDADES/clinix-backup.service"
install -m 644 "$ORIGEN/clinix-backup.timer" "$UNIDADES/clinix-backup.timer"
systemd-analyze verify "$UNIDADES/clinix-backup.service" "$UNIDADES/clinix-backup.timer"
systemctl daemon-reload

echo 'Probando un respaldo real. PostgreSQL debe estar iniciado; se espera hasta 5 minutos.'
if ! systemctl start clinix-backup.service; then
    echo 'ERROR: No se completó la prueba. El cron anterior sigue intacto.' >&2
    echo 'Revisa: journalctl -u clinix-backup.service -n 60 --no-pager' >&2
    exit 1
fi
systemctl enable --now clinix-backup.timer

# Releer para conservar las demás tareas que estén configuradas ahora.
leer_cron "$CRON_ACTUAL"
cp -- "$CRON_ACTUAL" "$DESTINO/crontab_al_cambiar_respaldo_${FECHA}.txt"
awk '
    /^[[:space:]]*#/ { print; next }
    index($0, "/bin/bash /root/clinix/respaldo_clinix.sh") { next }
    { print }
' "$CRON_ACTUAL" >"$CRON_NUEVO"
crontab "$CRON_NUEVO"

echo 'Instalado: respaldo diario a las 02:00 y recuperación de ejecución pendiente al encender.'
echo "Se conservaron el script anterior y el crontab en $DESTINO."
systemctl list-timers --all --no-pager clinix-backup.timer
