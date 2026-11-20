#!/bin/bash
# Sauvegarde nocturne de Study in World : base + documents des candidats + deploy/.env, dans une archive chiffrée
# (gpg, AES-256) envoyée sur Backblaze B2. Annonce la réussite ou l'échec sur le groupe Telegram de l'équipe.
# Cron : 30 2 * * * /srv/platforms/studyinworld/deploy/backup.sh >> /var/log/studyinworld-backup.log 2>&1
#
# B2 garde 30 jours (règle de cycle de vie du compartiment ; la clé du VPS ne peut pas supprimer), le VPS 7 jours.
# Aucun secret n'est affiché : la phrase de chiffrement passe par un descripteur de fichier, les clés B2 par
# l'environnement de rclone.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"
. ./telegram.sh

# Une variable absente renvoie une valeur vide (sans arrêter le script en mode strict).
env_get() { { grep -E "^$1=" .env 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
PG_USER="$(env_get POSTGRES_USER)"; PG_USER="${PG_USER:-siw}"
PG_DB="$(env_get POSTGRES_DB)"; PG_DB="${PG_DB:-siw}"
PASSPHRASE="$(env_get BACKUP_PASSPHRASE)"
B2_BUCKET="$(env_get B2_BUCKET)"
export RCLONE_B2_ACCOUNT="$(env_get B2_ACCOUNT_ID)" RCLONE_B2_KEY="$(env_get B2_APPLICATION_KEY)"
REMOTE="${BACKUP_REMOTE:-:b2:${B2_BUCKET}/studyinworld}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/studyinworld}"
PROJECT="${COMPOSE_PROJECT:-studyinworld}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)
FILE="siw-$(date +%F).tar.gz.gpg"

step="vérification des réglages"
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap 'tg "❌ <b>Échec de la sauvegarde</b> — Study in World\nÉtape : ${step}"; cleanup' ERR
trap cleanup EXIT
[ -n "$PASSPHRASE" ] || { echo "BACKUP_PASSPHRASE manquante dans deploy/.env" >&2; false; }
[ -n "${BACKUP_REMOTE:-}" ] || [ -n "$B2_BUCKET" ] || { echo "B2_BUCKET manquant dans deploy/.env" >&2; false; }
mkdir -p "$LOCAL_DIR" && chmod 700 "$LOCAL_DIR"

step="export de la base"
"${COMPOSE[@]}" exec -T db pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$WORK/db.dump"

step="copie des documents"
docker run --rm -v "${PROJECT}_documents:/data:ro" -v "$WORK:/out" alpine:3.20 tar -C /data -czf /out/documents.tar.gz .

step="chiffrement"
cp .env "$WORK/env"
tar -C "$WORK" -czf - db.dump documents.tar.gz env \
  | gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase-fd 3 -o "$LOCAL_DIR/$FILE" 3<<<"$PASSPHRASE"
chmod 600 "$LOCAL_DIR/$FILE"

step="envoi vers Backblaze B2"
rclone copy "$LOCAL_DIR/$FILE" "$REMOTE"

step="nettoyage des copies locales"
find "$LOCAL_DIR" -name 'siw-*.tar.gz.gpg' -mtime +7 -delete

size="$(du -h "$LOCAL_DIR/$FILE" | cut -f1)"
tg "✅ <b>Sauvegarde réussie</b> — Study in World\n${FILE} (${size}), envoyée sur Backblaze B2."
echo "Sauvegarde : $LOCAL_DIR/$FILE ($size)"
