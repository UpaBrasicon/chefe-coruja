#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Skill Chefe Coruja — dados OPERACIONAIS (usada pelo Nous via terminal)
# Consulta o Supabase REST com a service_role key (do .env do Nous).
#
# ⚠️ REGRA DE OURO ABSOLUTA: consulta APENAS dados operacionais/agregados.
#    NUNCA toca tabelas de paciente (pacientes, prescricoes, observacao,
#    internacoes com detalhe clínico, documentos_clinicos...).
# ⚠️ service_role bypassa RLS — o filtro de papel/unidade é responsabilidade
#    do agente (nunca misturar unidades).
#
# Uso:
#   operacional.sh <comando> [args...]
#   setores <unidade_id>
#   unidades [organizacao_id]
#   profissionais <unidade_id>        (nome + papel — sem dado clínico)
#   indicadores <unidade_id>
#   censo <unidade_id>
#   alertas_escala <unidade_id> [status]
#   notificacoes <unidade_id> [dias]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL não definida}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?chave não definida}"
AUTH="apikey: $SUPABASE_SERVICE_ROLE_KEY"
AUTH2="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

comando="${1:?uso: operacional.sh <comando> [args...]}"
api() { curl -s "$SUPABASE_URL/rest/v1/$1" -H "$AUTH" -H "$AUTH2"; }

case "$comando" in
  setores)
    unidade="${2:?unidade_id obrigatório}"
    api "setores?select=id,nome,tipo,ordem,ativo&unidade_id=eq.$unidade&ativo=eq.true&order=ordem.asc"
    ;;

  unidades)
    org="${2:-}"
    if [ -n "$org" ]; then
      api "unidades?select=id,nome,tipo,cnes,municipio,uf,ativo&organizacao_id=eq.$org&ativo=eq.true&order=nome.asc"
    else
      api "unidades?select=id,nome,tipo,cnes,municipio,uf,ativo&ativo=eq.true&order=nome.asc"
    fi
    ;;

  profissionais)
    unidade="${2:?unidade_id obrigatório}"
    # Vínculos ativos com nome e papel (NUNCA dado clínico)
    api "vinculos?select=perfil_id,perfis!vinculos_perfil_id_fkey(nome_completo,crm,uf_crm),papel,ativo&unidade_id=eq.$unidade&ativo=eq.true"
    ;;

  indicadores)
    unidade="${2:?unidade_id obrigatório}"
    api "vw_indicadores_unidade?select=unidade_id,unidade_nome,total_pacientes,prescricoes_assinadas,prescricoes_rascunho,receitas_retidas&unidade_id=eq.$unidade"
    ;;

  censo)
    unidade="${2:?unidade_id obrigatório}"
    api "censo_ocupacao?select=data,turno,internados,leitos_total,leitos_ocupados,leitos_livres,taxa_ocupacao&unidade_id=eq.$unidade&order=data.desc,turno.asc&limit=6"
    ;;

  alertas_escala)
    unidade="${2:?unidade_id obrigatório}"
    status="${3:-novo}"
    api "chronos_alertas_escala?select=medico_id,metrica,valor,mediana_unidade,limite_outlier,status,criado_em&unidade_id=eq.$unidade&status=eq.$status&order=criado_em.desc&limit=20"
    ;;

  notificacoes)
    unidade="${2:?unidade_id obrigatório}"
    dias="${3:-7}"
    desde="$(date -d "-$dias days" +%F 2>/dev/null || date -v-${dias}d +%F)"
    api "notificacoes_plantonista?select=data,tipo,mensagem,created_at&unidade_id=eq.$unidade&data=gte.$desde&order=created_at.desc&limit=20"
    ;;

  *)
    echo "comando desconhecido: $comando (setores|unidades|profissionais|indicadores|censo|alertas_escala|notificacoes)" >&2
    exit 1
    ;;
esac
