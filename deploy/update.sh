#!/bin/sh
# Met à jour Study in World sur le VPS : récupère main, reconstruit et relance (les migrations s'appliquent au démarrage).
set -e
cd "$(dirname "$0")/.."
git pull --ff-only origin main
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker image prune -f >/dev/null
echo "Mise à jour terminée. Journaux de l'API : docker compose -f $(pwd)/docker-compose.prod.yml logs -f api"
