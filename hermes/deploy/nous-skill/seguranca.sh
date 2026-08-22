#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — SEGURANÇA (Cérbero) — usada pelo Nous via terminal
#
# A guarda "exclusivo super_admin" é aplicada NO BACKEND (POST /skill/consulta),
# contra a tabela `super_admins` — não mais só no texto do SKILL.md. Quem não
# tem o privilégio recebe a mensagem genérica e nenhum dado.
#
# Uso:
#   seguranca.sh incidentes [patrulha] [severidade]
#   seguranca.sh quarentena [status]
# ─────────────────────────────────────────────────────────────────────────────
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

comando="${1:?uso: seguranca.sh <incidentes|quarentena> [args...]}"

case "$comando" in
  incidentes)
    args='{}'
    if [ -n "${2:-}" ]; then
      patrulha="$(validar_enum "$2" patrulha dados conteudo hermes)"
      args="$(jq -nc --arg p "$patrulha" '{patrulha:$p}')"
    fi
    if [ -n "${3:-}" ]; then
      severidade="$(validar_enum "$3" severidade critico atencao informativo)"
      args="$(printf '%s' "$args" | jq -c --arg s "$severidade" '. + {severidade:$s}')"
    fi
    cache_ou_executa 60 "incidentes-${2:-}-${3:-}-${CORUJA_WA_ID:-}" \
      api_hermes seguranca incidentes "$args"
    ;;

  quarentena)
    args='{}'
    if [ -n "${2:-}" ]; then
      status="$(validar_enum "$2" status pendente analisado liberado)"
      args="$(jq -nc --arg s "$status" '{status:$s}')"
    fi
    cache_ou_executa 60 "quarentena-${2:-}-${CORUJA_WA_ID:-}" \
      api_hermes seguranca quarentena "$args"
    ;;

  *)
    morrer "comando desconhecido: $comando (incidentes|quarentena)"
    ;;
esac
