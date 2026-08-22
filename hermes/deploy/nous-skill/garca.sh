#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GARÇA (Asclépio) — indicadores clínicos AGREGADOS (usada pelo Nous via terminal)
# ⚠️ LGPD: APENAS totais/agregados. NUNCA dado identificável de paciente.
# `internacoes` retorna CONTAGEM por status — a lista de pacientes nunca sai
# do backend.
#
# Uso:
#   garca.sh indicadores [unidade_id]
#   garca.sh censo [unidade_id]
#   garca.sh internacoes [unidade_id]
# ─────────────────────────────────────────────────────────────────────────────
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

comando="$(validar_enum "${1:?uso: garca.sh <indicadores|censo|internacoes> [unidade_id]}" \
  comando indicadores censo internacoes)"

args='{}'
if [ -n "${2:-}" ]; then
  unidade="$(validar_uuid "$2" unidade_id)"
  args="$(jq -nc --arg u "$unidade" '{unidade_id:$u}')"
fi

cache_ou_executa 120 "garca-$comando-${2:-}-${CORUJA_WA_ID:-}" \
  api_hermes garca "$comando" "$args"
