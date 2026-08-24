#!/bin/bash
# ============================================
# BACKUP SCRIPT - BRASARGENT
# ============================================

set -e

BACKUP_DIR="/var/backups/brasargent"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Cargar variables desde .env si existe
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DB_ROOT_PASS="${DB_ROOT_PASSWORD:-$DB_PASSWORD}"
DB_NAME_VAL="${DB_NAME:-brasargent}"

# Respaldo de base de datos
echo "📦 Respaldando base de datos MySQL..."
docker exec brasargent-db mysqldump -u root -p"$DB_ROOT_PASS" "$DB_NAME_VAL" > "$BACKUP_DIR/db_$DATE.sql"

# Respaldo de archivos
echo "📦 Respaldando archivos dist de aplicación..."
docker cp brasargent-app:/app/dist "$BACKUP_DIR/files_$DATE"

echo "✅ Backup completado exitosamente:"
echo "   - Base de datos: $BACKUP_DIR/db_$DATE.sql"
echo "   - Archivos: $BACKUP_DIR/files_$DATE"
