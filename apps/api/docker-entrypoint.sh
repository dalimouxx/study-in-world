#!/bin/sh
set -e
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "→ Application des migrations"
  npx prisma migrate deploy
elif [ "${ALLOW_DB_PUSH:-false}" = "true" ]; then
  echo "! Aucune migration trouvée : prisma db push (DEV UNIQUEMENT)"
  npx prisma db push --skip-generate
else
  echo "Aucune migration dans prisma/migrations. Créez-la : npx prisma migrate dev --name init" >&2
  exit 1
fi
exec "$@"
