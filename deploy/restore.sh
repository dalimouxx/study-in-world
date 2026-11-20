#!/bin/bash
# Restauration d'une sauvegarde de Study in World.
#   restore.sh AAAA-MM-JJ              → contrôle sans risque : base « siw_restore_check » à part, affiche le nombre
#                                        d'utilisateurs, de candidats et de documents, puis efface tout ce contrôle.
#   restore.sh AAAA-MM-JJ --env-only   → VPS neuf : écrit seulement deploy/.env à partir de la sauvegarde (à faire
#                                        AVANT de démarrer la base, pour qu'elle prenne le bon mot de passe).
#   restore.sh AAAA-MM-JJ --production → remplace la base et les documents de production (confirmation tapée).
# L'archive est prise sur le VPS si elle y est encore, sinon sur Backblaze B2. La phrase de chiffrement est lue dans
# deploy/.env, ou demandée (sans affichage) s'il n'y en a pas. Les fichiers déchiffrés sont toujours effacés à la fin.
set -euo pipefail
DATE="${1:-}"; MODE="${2:-}"
[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "Usage : $0 AAAA-MM-JJ [--env-only|--production]" >&2; exit 2; }
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"
. ./telegram.sh

# Une variable absente renvoie une valeur vide (sans arrêter le script en mode strict).
env_get() { { grep -E "^$1=" .env 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
PASSPHRASE="$(env_get BACKUP_PASSPHRASE)"
[ -n "$PASSPHRASE" ] || { read -rsp "Phrase de chiffrement des sauvegardes : " PASSPHRASE; echo; }
B2_BUCKET="$(env_get B2_BUCKET)"
export RCLONE_B2_ACCOUNT="$(env_get B2_ACCOUNT_ID)" RCLONE_B2_KEY="$(env_get B2_APPLICATION_KEY)"
REMOTE="${BACKUP_REMOTE:-:b2:${B2_BUCKET}/studyinworld}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/studyinworld}"
PROJECT="${COMPOSE_PROJECT:-studyinworld}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)
FILE="siw-${DATE}.tar.gz.gpg"

# Dossier de travail privé, effacé quoi qu'il arrive : les données déchiffrées ne restent jamais sur le disque.
OUT="$(mktemp -d "${TMPDIR:-/var/tmp}/studyinworld-restore.XXXXXX")"
chmod 700 "$OUT"
trap 'rm -rf "$OUT"' EXIT

mkdir -p "$LOCAL_DIR"
if [ ! -f "$LOCAL_DIR/$FILE" ]; then
  echo "→ Récupération de $FILE sur Backblaze B2"
  rclone copy "$REMOTE/$FILE" "$LOCAL_DIR"
fi

echo "→ Déchiffrement"
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 -d "$LOCAL_DIR/$FILE" 3<<<"$PASSPHRASE" | tar -C "$OUT" -xzf -

if [ "$MODE" = "--env-only" ]; then
  if [ -f .env ] && [ -n "$(env_get POSTGRES_PASSWORD)" ]; then
    read -rp "deploy/.env existe déjà avec des réglages. Le remplacer par celui de la sauvegarde ? Tapez REMPLACER : " answer
    [ "$answer" = "REMPLACER" ] || { echo "Annulé."; exit 1; }
  fi
  install -m 600 "$OUT/env" .env
  echo "deploy/.env restauré depuis la sauvegarde du $DATE. Démarrez la base, puis : $0 $DATE --production"
  exit 0
fi

env_get_restored() { { grep -E "^$1=" "$OUT/env" 2>/dev/null || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
PG_USER="$(env_get POSTGRES_USER)"; PG_USER="${PG_USER:-siw}"
PG_DB="$(env_get POSTGRES_DB)"; PG_DB="${PG_DB:-siw}"
psql_in() { "${COMPOSE[@]}" exec -T db psql -U "$PG_USER" -d "$1" -v ON_ERROR_STOP=1 -tAc "$2"; }
mkdir -p "$OUT/documents"
tar -C "$OUT/documents" -xzf "$OUT/documents.tar.gz"

if [ "$MODE" != "--production" ]; then
  echo "→ Restauration de contrôle dans la base siw_restore_check (la production n'est pas touchée)"
  trap 'psql_in postgres "DROP DATABASE IF EXISTS siw_restore_check" >/dev/null 2>&1 || true; rm -rf "$OUT"' EXIT
  psql_in postgres "DROP DATABASE IF EXISTS siw_restore_check" >/dev/null
  psql_in postgres "CREATE DATABASE siw_restore_check" >/dev/null
  "${COMPOSE[@]}" exec -T db pg_restore -U "$PG_USER" -d siw_restore_check --no-owner --exit-on-error < "$OUT/db.dump"
  echo "Sauvegarde du $DATE :"
  echo "  utilisateurs : $(psql_in siw_restore_check 'select count(*) from "User"')"
  echo "  candidats    : $(psql_in siw_restore_check 'select count(*) from "Candidate"')"
  echo "  documents    : $(psql_in siw_restore_check 'select count(*) from "CandidateDocument"') en base, $(find "$OUT/documents" -type f | wc -l) fichiers"
  echo "  réglages     : $( [ -n "$(env_get_restored POSTGRES_PASSWORD)" ] && echo 'présents' || echo 'ABSENTS')"
  echo "Contrôle terminé : la base de contrôle et les fichiers déchiffrés sont effacés."
  exit 0
fi

read -rp "Remplacer la base ET les documents de production par la sauvegarde du $DATE ? Tapez RESTAURER : " answer
[ "$answer" = "RESTAURER" ] || { echo "Annulé."; exit 1; }

# En cas d'échec en cours de route : le site est relancé et le groupe Telegram prévenu (jamais d'arrêt silencieux).
step="préparation"
trap 'tg "❌ <b>Échec de la restauration</b> — Study in World\nÉtape : ${step}. Vérifiez le site."; psql_in postgres "DROP DATABASE IF EXISTS siw_restore_new" >/dev/null 2>&1 || true; "${COMPOSE[@]}" start api web >/dev/null 2>&1 || true' ERR
# 1. La sauvegarde est d'abord restaurée dans une base à part : si elle est abîmée, la production n'est pas touchée.
step="restauration de la base dans une base temporaire"
echo "→ Restauration de la base dans une base temporaire"
psql_in postgres "DROP DATABASE IF EXISTS siw_restore_new" >/dev/null
psql_in postgres "CREATE DATABASE siw_restore_new OWNER \"$PG_USER\"" >/dev/null
"${COMPOSE[@]}" exec -T db pg_restore -U "$PG_USER" -d siw_restore_new --no-owner --exit-on-error --single-transaction < "$OUT/db.dump"
# 2. Seulement alors : arrêt, remplacement instantané de la base (renommage), aucune table d'avant ne subsiste.
step="arrêt du site et de l'API"
echo "→ Arrêt du site et de l'API"
"${COMPOSE[@]}" stop api web
step="remplacement de la base"
echo "→ Remplacement de la base de production"
psql_in postgres "DROP DATABASE IF EXISTS \"$PG_DB\" WITH (FORCE)" >/dev/null
psql_in postgres "ALTER DATABASE siw_restore_new RENAME TO \"$PG_DB\"" >/dev/null
step="restauration des documents"
echo "→ Restauration des documents"
docker run --rm -v "${PROJECT}_documents:/data" -v "$OUT:/in:ro" alpine:3.20 sh -c 'find /data -mindepth 1 -delete && tar -C /data -xzf /in/documents.tar.gz'
step="redémarrage"
echo "→ Redémarrage"
"${COMPOSE[@]}" start api web
trap - ERR
tg "♻️ <b>Restauration effectuée</b> — Study in World\nSauvegarde du ${DATE}."
echo "Restauration terminée."
