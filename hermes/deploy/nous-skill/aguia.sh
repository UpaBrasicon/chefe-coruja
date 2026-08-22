#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ÁGUIA (Athena) — resumo operacional da unidade (usada pelo Nous via terminal)
# Visão ampla: setores, censo atual, indicadores, profissionais ativos.
# NUNCA dado de paciente.
#
# A unidade NÃO é mais escolhida pelo agente: o backend usa o vínculo do
# usuário da sessão. O argumento opcional só serve para quem tem mais de um
# vínculo — pedir unidade não vinculada é bloqueado no servidor.
#
# Uso:
#   aguia.sh resumo [unidade_id]
#   aguia.sh profissionais [unidade_id]
#   aguia.sh censo [unidade_id]
#   aguia.sh indicadores [unidade_id]
# ─────────────────────────────────────────────────────────────────────────────
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

comando="$(validar_enum "${1:?uso: aguia.sh <resumo|profissionais|censo|indicadores> [unidade_id]}" \
  comando resumo profissionais censo indicadores)"

args='{}'
if [ -n "${2:-}" ]; then
  unidade="$(validar_uuid "$2" unidade_id)"
  args="$(json_args "unidade_id=$unidade")"
fi

cache_ou_executa 120 "aguia-$comando-${2:-}-${CORUJA_WA_ID:-}" \
  api_hermes aguia "$comando" "$args"
