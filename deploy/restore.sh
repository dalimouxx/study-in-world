#!/bin/bash
# Restauration d'une sauvegarde de Study in World.
#   restore.sh AAAA-MM-JJ              → contrôle sans risque : base « siw_restore_check » et dossier à part,
#                                        puis affiche le nombre d'utilisateurs, de candidats et de documents.
#   restore.sh AAAA-MM-JJ --production → remplace la base et les documents de production (confirmation tapée).
# L'archive est prise sur le VPS si elle y est encore, sinon sur Backblaze B2. La phrase de chiffrement est lue dans
# deploy/.env, ou demandée (sans affichage) s'il n'y en a pas — par exemple sur un VPS neuf.
set -euo pipefail
DATE="${1:-}"; MODE="${2:-}"
[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "Usage : $0 AAAA-MM-JJ [--production]" >&2; exit 2; }
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"
. ./telegram.sh

# Une variable absente renvoie une valeur vide (sans arrêter le script en mode strict).
env_get() { { grep -E "^$1=" .env 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
PG_USER="$(env_get POSTGRES_USER)"; PG_USER="${PG_USER:-siw}"
PG_DB="$(env_get POSTGRES_DB)"; PG_DB="${PG_DB:-siw}"
PASSPHRASE="$(env_get BACKUP_PASSPHRASE)"
[ -n "$PASSPHRASE" ] || { read -rsp "Phrase de chiffrement des sauvegardes : " PASSPHRASE; echo; }
B2_BUCKET="$(env_get B2_BUCKET)"
export RCLONE_B2_ACCOUNT="$(env_get B2_ACCOUNT_ID)" RCLONE_B2_KEY="$(env_get B2_APPLICATION_KEY)"
REMOTE="${BACKUP_REMOTE:-:b2:${B2_BUCKET}/studyinworld}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/studyinworld}"
PROJECT="${COMPOSE_PROJECT:-studyinworld}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)
FILE="siw-${DATE}.tar.gz.gpg"
OUT="${RESTORE_DIR:-/var/tmp/studyinworld-restore}"

mkdir -p "$LOCAL_DIR"
if [ ! -f "$LOCAL_DIR/$FILE" ]; then
  echo "→ Récupération de $FILE sur Backblaze B2"
  rclone copy "$REMOTE/$FILE" "$LOCAL_DIR"
fi

echo "→ Déchiffrement"
rm -rf "$OUT" && mkdir -p "$OUT/documents" && chmod 700 "$OUT"
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 -d "$LOCAL_DIR/$FILE" 3<<<"$PASSPHRASE" | tar -C "$OUT" -xzf -
chmod 600 "$OUT/env"
tar -C "$OUT/documents" -xzf "$OUT/documents.tar.gz"

psql_in() { "${COMPOSE[@]}" exec -T db psql -U "$PG_USER" -d "$1" -tAc "$2"; }

if [ "$MODE" != "--production" ]; then
  echo "→ Restauration de contrôle dans la base siw_restore_check (la production n'est pas touchée)"
  psql_in postgres "DROP DATABASE IF EXISTS siw_restore_check" >/dev/null
  psql_in postgres "CREATE DATABASE siw_restore_check" >/dev/null
  "${COMPOSE[@]}" exec -T db pg_restore -U "$PG_USER" -d siw_restore_check --no-owner < "$OUT/db.dump"
  echo "Sauvegarde du $DATE :"
  echo "  utilisateurs : $(psql_in siw_restore_check 'select count(*) from "User"')"
  echo "  candidats    : $(psql_in siw_restore_check 'select count(*) from "Candidate"')"
  echo "  documents    : $(psql_in siw_restore_check 'select count(*) from "CandidateDocument"') en base, $(find "$OUT/documents" -type f | wc -l) fichiers"
  echo "Fichiers restaurés dans $OUT (réglages du serveur : $OUT/env)."
  echo "Supprimer la base de contrôle : docker compose -f $DEPLOY_DIR/docker-compose.prod.yml exec db psql -U $PG_USER -d postgres -c 'DROP DATABASE siw_restore_check'"
  exit 0
fi

read -rp "Remplacer la base ET les documents de production par la sauvegarde du $DATE ? Tapez RESTAURER : " answer
[ "$answer" = "RESTAURER" ] || { echo "Annulé."; exit 1; }
echo "→ Arrêt du site et de l'API"
"${COMPOSE[@]}" stop api web
echo "→ Restauration de la base"
"${COMPOSE[@]}" exec -T db pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists --no-owner < "$OUT/db.dump"
echo "→ Restauration des documents"
docker run --rm -v "${PROJECT}_documents:/data" -v "$OUT:/in:ro" alpine:3.20 sh -c 'find /data -mindepth 1 -delete && tar -C /data -xzf /in/documents.tar.gz'
echo "→ Redémarrage"
"${COMPOSE[@]}" start api web
tg "♻️ <b>Restauration effectuée</b> — Study in World\nSauvegarde du ${DATE}."
echo "Restauration terminée. Les réglages sauvegardés sont dans $OUT/env (à comparer avec deploy/.env si besoin)."
