#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — dados OPERACIONAIS (usada pelo Nous via terminal)
#
# ⚠️ REGRA DE OURO: apenas dados operacionais/agregados. NUNCA tabelas de
#    paciente (pacientes, prescricoes, observacao, documentos_clinicos...).
#
# MUDANÇA DE SEGURANÇA (C1): as consultas passam pelo backend, que resolve a
# unidade a partir do vínculo do usuário da sessão. `alertas_escala` saiu
# daqui — é dado do Sentinela, restrito a gestor/admin (use sentinela.sh).
#
# Uso:
#   operacional.sh setores|profissionais|indicadores|censo [unidade_id]
#   operacional.sh notificacoes [dias]
# ─────────────────────────────────────────────────────────────────────────────
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

comando="$(validar_enum "${1:?uso: operacional.sh <comando> [args...]}" \
  comando setores profissionais indicadores censo notificacoes)"

case "$comando" in
  notificacoes)
    dias="$(validar_inteiro "${2:-7}" dias 90)"
    args="$(json_args_num "dias=$dias")"
    cache_ou_executa 60 "notif-$dias-${CORUJA_WA_ID:-}" \
      api_hermes operacional notificacoes "$args"
    ;;

  *)
    args='{}'
    if [ -n "${2:-}" ]; then
      unidade="$(validar_uuid "$2" unidade_id)"
      args="$(json_args "unidade_id=$unidade")"
    fi
    cache_ou_executa 60 "op-$comando-${2:-}-${CORUJA_WA_ID:-}" \
      api_hermes operacional "$comando" "$args"
    ;;
esac
