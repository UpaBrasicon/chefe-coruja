#!/usr/bin/env bash
# Verifica se o bot Telegram está escutando (409 = long-polling ativo) — 23/08
TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' /home/hermes/.hermes/.env | cut -d= -f2 | tr -d '\r' | tr -d '"')
if [ -z "$TOKEN" ]; then
  echo "SEM TELEGRAM_BOT_TOKEN no .env"
  exit 1
fi
HTTP=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=1")
echo "getUpdates → HTTP $HTTP"
if [ "$HTTP" = "409" ]; then
  echo "✅ 409 = o bot JÁ está escutando (long-polling ativo) — Telegram OK"
elif [ "$HTTP" = "200" ]; then
  echo "ℹ️ 200 = bot alcançável (sem polling ativo neste instante)"
else
  echo "⚠️ HTTP $HTTP — verificar"
fi
