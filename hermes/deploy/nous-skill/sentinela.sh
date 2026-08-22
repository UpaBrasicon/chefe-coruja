#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — SENTINELA — usada pelo Nous via terminal
#
# A guarda "somente gestor/admin" e o filtro de unidade são aplicados NO
# BACKEND: a unidade vem do vínculo do usuário, não do argumento. Plantonista
# recebe a mensagem genérica.
#
# Uso:
#   sentinela.sh alertas [status]
#   sentinela.sh relatorio
# ─────────────────────────────────────────────────────────────────────────────
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

comando="${1:?uso: sentinela.sh <alertas|relatorio> [args...]}"

case "$comando" in
  alertas)
    status="$(validar_enum "${2:-novo}" status novo visto em_acompanhamento justificado)"
    args="$(json_args "status=$status")"
    cache_ou_executa 300 "alertas-$status-${CORUJA_WA_ID:-}" \
      api_hermes sentinela alertas "$args"
    ;;

  relatorio)
    cache_ou_executa 300 "relatorio-semanal-${CORUJA_WA_ID:-}" \
      api_hermes sentinela relatorio '{}'
    ;;

  *)
    morrer "comando desconhecido: $comando (alertas|relatorio)"
    ;;
esac
