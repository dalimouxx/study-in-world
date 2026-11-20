#!/bin/bash
# Envoi d'un message au groupe Telegram de l'équipe, pour les scripts du VPS (déploiement, surveillance).
# Lit TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID dans deploy/.env ; sans eux, ne fait rien. N'échoue jamais.
# Usage : . ./telegram.sh ; tg "<b>Titre</b>\nDétail"

_tg_env() { grep -E "^$1=" "$(dirname "${BASH_SOURCE[0]}")/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'; }
TG_TOKEN="$(_tg_env TELEGRAM_BOT_TOKEN)"
TG_CHAT="$(_tg_env TELEGRAM_CHAT_ID)"

# Échappe un texte libre (message de commit…) pour le HTML de Telegram.
tg_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

tg() {
  [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ] || return 0
  curl -fsS -m 10 -o /dev/null "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=$(printf '%b' "$1")" \
    --data-urlencode "parse_mode=HTML" --data-urlencode "disable_web_page_preview=true" || true
}
