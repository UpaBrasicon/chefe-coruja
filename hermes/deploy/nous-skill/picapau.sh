#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PICA-PAU (Hefesto) — status de infraestrutura (usada pelo Nous via terminal)
# EXCLUSIVO super_admin — guarda aplicada no backend (tabela `super_admins`).
# NUNCA dado de paciente.
#
# Uso:
#   picapau.sh health
#   picapau.sh integridade
# ─────────────────────────────────────────────────────────────────────────────
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

comando="$(validar_enum "${1:?uso: picapau.sh <health|integridade>}" comando health integridade)"
BACKEND="${HERMES_BACKEND_URL:-http://localhost:3000}"

case "$comando" in
  health)
    # /health é público e não expõe dado — resposta resumida via jq (nunca
    # truncar bytes: JSON cortado ao meio faz o agente alucinar o resto).
    resposta="$(curl -s -m 5 "$BACKEND/health" 2>/dev/null || printf '')"
    if [ -z "$resposta" ]; then
      printf '{"status":"indisponivel"}'
      exit 0
    fi
    printf '%s' "$resposta" \
      | jq -c '{status, redis, supabase, uptime: (.uptime | floor)}' 2>/dev/null \
      || printf '{"status":"resposta_invalida"}'
    ;;

  integridade)
    api_hermes infra integridade '{}'
    ;;
esac
