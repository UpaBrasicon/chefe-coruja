#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — consulta de ESCALA (usada pelo Nous via terminal)
#
# MUDANÇA DE SEGURANÇA (C1): `meus_plantoes` não recebe mais perfil_id. O
# backend usa SEMPRE o perfil da sessão — antes bastava passar outro id para
# ler a escala de qualquer médico. `plantao_do_dia` exige gestor/admin e roda
# na unidade do vínculo.
#
# Uso:
#   escala.sh meus_plantoes [hoje|semana|mes]
#   escala.sh plantao_do_dia [YYYY-MM-DD]
# ─────────────────────────────────────────────────────────────────────────────
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

comando="$(validar_enum "${1:?uso: escala.sh <meus_plantoes|plantao_do_dia> [args...]}" \
  comando meus_plantoes plantao_do_dia)"

case "$comando" in
  meus_plantoes)
    periodo="$(validar_enum "${2:-semana}" periodo hoje semana mes)"
    args="$(jq -nc --arg p "$periodo" '{periodo:$p}')"
    cache_ou_executa 60 "meus-$periodo-${CORUJA_WA_ID:-}" \
      api_hermes escala meus_plantoes "$args"
    ;;

  plantao_do_dia)
    args='{}'
    if [ -n "${2:-}" ]; then
      [[ "$2" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || morrer "data inválida (use AAAA-MM-DD)"
      args="$(jq -nc --arg d "$2" '{data:$d}')"
    fi
    cache_ou_executa 60 "dia-${2:-hoje}-${CORUJA_WA_ID:-}" \
      api_hermes escala plantao_do_dia "$args"
    ;;
esac
