#!/bin/bash
# Met à jour Study in World sur le VPS : récupère main, reconstruit et relance (les migrations s'appliquent au
# démarrage). Annonce le début, la réussite ou l'échec sur le groupe Telegram de l'équipe.
set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DEPLOY_DIR/telegram.sh"
cd "$DEPLOY_DIR/.."

trap 'tg "❌ <b>Échec du déploiement</b> de Study in World\nÉtape : $(printf %s "$BASH_COMMAND" | head -c 120 | tg_escape)\nVoir : docker compose -f $DEPLOY_DIR/docker-compose.prod.yml logs api"' ERR

tg "🚀 <b>Déploiement en cours</b> — Study in World"
git pull --ff-only origin main
cd "$DEPLOY_DIR"
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker image prune -f >/dev/null

# Attendre que l'API réponde (migrations comprises), 2 minutes au plus.
for _ in $(seq 1 24); do
  docker compose -f docker-compose.prod.yml exec -T api wget -qO- http://localhost:4000/api/health >/dev/null 2>&1 && ok=1 && break
  sleep 5
done
[ "${ok:-0}" = 1 ] || { tg "❌ <b>Déploiement terminé, mais l'API ne répond pas</b>\nVoir : docker compose -f $DEPLOY_DIR/docker-compose.prod.yml logs api"; exit 1; }

version="$(git log -1 --format='%h — %s' | tg_escape)"
tg "✅ <b>Déploiement réussi</b> — Study in World\n<code>${version}</code>"
echo "Mise à jour terminée."
