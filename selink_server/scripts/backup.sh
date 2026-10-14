#!/bin/sh
set -eu

umask 077
APP_DIR=${APP_DIR:-/opt/smartmotor}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/smartmotor}
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

set -a
. ./.env
set +a

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -9 > "$BACKUP_DIR/db-$STAMP.sql.gz"
tar -czf "$BACKUP_DIR/config-$STAMP.tar.gz" .env emqx/certs

find "$BACKUP_DIR" -type f \( -name 'db-*.sql.gz' -o -name 'config-*.tar.gz' \) -mtime "+$KEEP_DAYS" -delete
echo "backup completed: $STAMP"
