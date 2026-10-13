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

# Seed idempotent (organisation, rôles, permissions, Super Admin) : rejoué sans risque à chaque
# démarrage, utile sur les instances sans accès Shell (plan gratuit) où "npm run seed" ne peut pas
# être lancé manuellement. Ne bloque pas le démarrage de l'API en cas d'échec (ex: variables absentes).
if [ -n "${SEED_ADMIN_EMAIL:-}" ]; then
  echo "→ Seed (idempotent)"
  npx ts-node prisma/seed.ts || echo "! Le seed a échoué (voir ci-dessus) — l'API démarre quand même." >&2
else
  echo "SEED_ADMIN_EMAIL absent : seed ignoré."
fi

exec "$@"
