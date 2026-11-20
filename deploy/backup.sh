#!/bin/sh
# Sauvegarde compressée de la base Study in World ; garde les 14 dernières.
set -e
DIR=/var/backups/studyinworld
mkdir -p "$DIR"
cd "$(dirname "$0")"
. ./.env
docker compose -f docker-compose.prod.yml --env-file .env exec -T db pg_dump -U "${POSTGRES_USER:-siw}" "${POSTGRES_DB:-siw}" | gzip > "$DIR/siw-$(date +%F).sql.gz"
find "$DIR" -name 'siw-*.sql.gz' -mtime +14 -delete
echo "Sauvegarde : $DIR/siw-$(date +%F).sql.gz"
