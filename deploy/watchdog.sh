#!/bin/bash
# Surveillance de Study in World (cron toutes les 5 minutes) : teste le site et l'API par la passerelle Caddy du VPS.
# Prévient le groupe Telegram après 2 échecs de suite (évite les fausses alertes), puis au retour en ligne.
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DEPLOY_DIR/telegram.sh"
STATE_DIR=/var/lib/studyinworld
mkdir -p "$STATE_DIR"
FAILS_FILE="$STATE_DIR/watchdog.fails"; DOWN_FILE="$STATE_DIR/watchdog.down_since"
HOST=studyinworld.net

# --resolve : passe directement par la passerelle de ce VPS (le test ne dépend pas du DNS ni d'Internet).
check() { curl -fsS -m 15 -o /dev/null --resolve "$HOST:443:127.0.0.1" "$1"; }
problem=""
check "https://$HOST/api/health" || problem="l'API ne répond pas"
check "https://$HOST/fr" || problem="${problem:+$problem, }le site ne répond pas"

if [ -n "$problem" ]; then
  fails=$(( $(cat "$FAILS_FILE" 2>/dev/null || echo 0) + 1 ))
  echo "$fails" > "$FAILS_FILE"
  if [ "$fails" -ge 2 ] && [ ! -f "$DOWN_FILE" ]; then
    date +%s > "$DOWN_FILE"
    tg "🔴 <b>Study in World est hors service</b>\n${problem} (2 contrôles de suite).\nVoir : docker compose -f $DEPLOY_DIR/docker-compose.prod.yml ps"
  fi
else
  if [ -f "$DOWN_FILE" ]; then
    minutes=$(( ( $(date +%s) - $(cat "$DOWN_FILE") ) / 60 ))
    tg "🟢 <b>Study in World est de nouveau en ligne</b>\nPanne d'environ ${minutes} min."
    rm -f "$DOWN_FILE"
  fi
  echo 0 > "$FAILS_FILE"
fi
