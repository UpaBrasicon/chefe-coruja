#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ÁGUIA (Athena) — resumo operacional da unidade (usada pelo Nous via terminal)
# Visão ampla: setores, censo atual, indicadores, profissionais ativos.
# NUNCA dado de paciente.
#
# Uso:
#   aguia.sh resumo <unidade_id>
#   aguia.sh profissionais <unidade_id>
#   aguia.sh censo <unidade_id>
#   aguia.sh indicadores <unidade_id>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL não definida}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?chave não definida}"
AUTH="apikey: $SUPABASE_SERVICE_ROLE_KEY"
AUTH2="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

comando="${1:?uso: aguia.sh <resumo|profissionais|censo|indicadores> [unidade_id]}"
api() { curl -s "$SUPABASE_URL/rest/v1/$1" -H "$AUTH" -H "$AUTH2"; }

CACHE_DIR="${TMPDIR:-/tmp}/gaviao-cache"
CACHE_TTL=120
mkdir -p "$CACHE_DIR"

api_cacheada() {
  local chave="$1" url="$2"
  local hash
  hash="$(printf '%s' "$url" | sha256sum | cut -d' ' -f1)"
  local arquivo="$CACHE_DIR/$hash"
  if [ -f "$arquivo" ] && [ $(( $(date +%s) - $(stat -c %Y "$arquivo" 2>/dev/null || echo 0) )) -lt $CACHE_TTL ]; then
    cat "$arquivo"
    return
  fi
  local resposta
  resposta="$(api "$url")"
  printf '%s' "$resposta" > "$arquivo"
  printf '%s' "$resposta"
}

case "$comando" in
  resumo)
    unidade="${2:?unidade_id obrigatório}"
    setores=$(api_cacheada "setores-$unidade" "setores?select=nome&unidade_id=eq.$unidade&ativo=eq.true&order=ordem.asc")
    censo=$(api_cacheada "censo-$unidade" "censo_ocupacao?select=data,turno,internados,leitos_total,leitos_ocupados,leitos_livres,taxa_ocupacao&unidade_id=eq.$unidade&order=data.desc,turno.asc&limit=3")
    profs=$(api_cacheada "profissionais-$unidade" "vinculos?select=papel,count&unidade_id=eq.$unidade&ativo=eq.true&group=papel" 2>/dev/null || echo "[]")
    jq -n --argjson setores "$setores" --argjson censo "$censo" --argjson profs "$profs" \
      '{setores: $setores, censo_recente: $censo, profissionais_por_papel: $profs}' 2>/dev/null \
      || printf '{"setores":%s,"censo_recente":%s}' "$setores" "$censo"
    ;;

  profissionais)
    unidade="${2:?unidade_id obrigatório}"
    api_cacheada "profissionais-$unidade" "vinculos?select=perfil_id,perfis!vinculos_perfil_id_fkey(nome_completo,crm,uf_crm),papel,ativo&unidade_id=eq.$unidade&ativo=eq.true"
    ;;

  censo)
    unidade="${2:?unidade_id obrigatório}"
    api_cacheada "censo-$unidade" "censo_ocupacao?select=data,turno,internados,leitos_total,leitos_ocupados,leitos_livres,taxa_ocupacao&unidade_id=eq.$unidade&order=data.desc,turno.asc&limit=6"
    ;;

  indicadores)
    unidade="${2:?unidade_id obrigatório}"
    api_cacheada "indicadores-$unidade" "vw_indicadores_unidade?select=unidade_id,unidade_nome,total_pacientes,prescricoes_assinadas,prescricoes_rascunho,receitas_retidas&unidade_id=eq.$unidade"
    ;;

  *)
    echo "comando desconhecido: $comando (resumo|profissionais|censo|indicadores)" >&2
    exit 1
    ;;
esac
