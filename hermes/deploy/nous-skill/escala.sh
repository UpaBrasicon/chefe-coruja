#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — consulta de escala (usada pelo Nous via terminal)
# Consulta o Supabase REST com a service_role key (do .env do Nous).
#
# Uso:
#   escala.sh meus_plantoes [hoje|semana|mes]
#   escala.sh plantao_do_dia <data YYYY-MM-DD> <unidade_id>
#   escala.sh padrão_escala <medico_id> <unidade_id> [30d|90d]
#
# ⚠️ REGRA DE OURO: retorna IDs e números, NUNCA dado clínico de paciente.
# ⚠️ service_role bypassa RLS — o filtro de papel é responsabilidade do agente
#    (nunca retornar plantões de outro médico para um plantonista).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL não definida}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?chave não definida}"

comando="${1:?uso: escala.sh <comando> [args...]}"

# Extrai o perfil pelo telefone/wa_id não é possível aqui — o agente passa o
# perfil_id resolvido. Consultas filtram SEMPRE por perfil_id explícito.

case "$comando" in
  meus_plantoes)
    # args: meus_plantoes <perfil_id> [periodo]
    perfil="${2:?perfil_id obrigatório}"
    periodo="${3:-semana}"
    hoje="$(date +%F)"
    case "$periodo" in
      hoje) fim="$hoje" ;;
      mes) fim="$(date -d '+1 month' +%F 2>/dev/null || date -v+1m +%F)" ;;
      *) fim="$(date -d '+7 days' +%F 2>/dev/null || date -v+7d +%F)" ;;
    esac
    curl -s "$SUPABASE_URL/rest/v1/escala_plantao?select=id,data,turno,rotulo,setor_id,setores!escala_plantao_setor_id_fkey(nome)&perfil_id=eq.$perfil&ativo=eq.true&data=gte.$hoje&data=lte.$fim&order=data.asc,turno.asc" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
    ;;

  plantao_do_dia)
    # args: plantao_do_dia <data> <unidade_id>
    data="${2:?data obrigatória (YYYY-MM-DD)}"
    unidade="${3:?unidade_id obrigatório}"
    curl -s "$SUPABASE_URL/rest/v1/escala_plantao?select=data,turno,rotulo,perfil_id,perfis!escala_plantao_perfil_id_fkey(nome_completo),setor_id,setores!escala_plantao_setor_id_fkey(nome)&unidade_id=eq.$unidade&data=eq.$data&ativo=eq.true&order=turno.asc" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
    ;;

  alertas_escala)
    # args: alertas_escala <unidade_id> [status]
    unidade="${2:?unidade_id obrigatório}"
    status="${3:-novo}"
    curl -s "$SUPABASE_URL/rest/v1/chronos_alertas_escala?select=medico_id,metrica,valor,mediana_unidade,limite_outlier,status,criado_em&unidade_id=eq.$unidade&status=eq.$status&order=criado_em.desc&limit=20" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
    ;;

  *)
    echo "comando desconhecido: $comando" >&2
    exit 1
    ;;
esac
