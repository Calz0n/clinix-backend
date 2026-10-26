#!/usr/bin/env bash
# ==============================================================================
# CLINIX - Script de Reinicio Forzado y Reconstrucción Limpia de Backend
# Compatible con Nodemailer (Gmail SMTP y servidores corporativos/municipales)
# Dirección de Salud Pública Municipal de Coatzacoalcos (2026-2029)
# ==============================================================================
set -e

echo "=========================================================="
echo " [CLINIX] Actualizando y Reiniciando Backend con Nodemailer..."
echo "=========================================================="

# 1. Eliminar archivos .zip antiguos para ahorrar espacio
echo "[1/5] Limpiando archivos temporales..."
rm -f /root/clinix/*.zip 2>/dev/null || true
rm -f /root/*.zip 2>/dev/null || true
rm -f *.zip 2>/dev/null || true

# 2. Detectar Podman o Docker
if command -v podman &> /dev/null; then
  ENGINE="podman"
elif command -v docker &> /dev/null; then
  ENGINE="docker"
else
  echo "ALERTA: Ni Podman ni Docker encontrados en el sistema."
  echo "Ejecutando directamente con Node.js..."
  npm install
  npm start
  exit 0
fi

echo "[2/5] Motor de contenedores detectado: $ENGINE"

# 3. Detectar red interna para comunicación con PostgreSQL
NET="clinix_net"
PG_NET=$($ENGINE inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' clinix_postgres 2>/dev/null || true)
if [ -n "$PG_NET" ]; then
  NET="$PG_NET"
fi
echo "[3/5] Red de base de datos asignada: $NET"

# 4. Forzar reconstrucción sin caché para aplicar cambios de código y dependencias
echo "[4/5] Reconstruyendo imagen sin caché (--no-cache)..."
$ENGINE build --no-cache -t clinix-backend -f Containerfile .

# 5. Detener y remover contenedor previo para evitar conflictos de nombres
echo "[5/5] Iniciando nuevo contenedor con Nodemailer..."
$ENGINE rm -f clinix_backend clinix-backend 2>/dev/null || true

ENV_FLAGS=""
if [ -f ".env" ]; then
  ENV_FLAGS="--env-file .env"
elif [ -f "../.env" ]; then
  ENV_FLAGS="--env-file ../.env"
fi

$ENGINE run -d --name clinix_backend \
  --replace \
  --network "$NET" \
  -p 3000:3000 \
  --restart unless-stopped \
  $ENV_FLAGS \
  clinix-backend

echo ""
echo "=========================================================="
echo " [CLINIX] Backend con Nodemailer reiniciado exitosamente."
echo " Verificando estado del contenedor..."
echo "=========================================================="
$ENGINE ps | grep -E "clinix_backend|clinix-backend" || true
echo ""
echo "Verificando respuesta del API en http://localhost:3000/api/health..."
sleep 2
curl -s http://localhost:3000/api/health || true
echo ""
echo "=========================================================="
