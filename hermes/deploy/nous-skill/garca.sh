#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GARÇA (Asclépio) — indicadores clínicos AGREGADOS (usada pelo Nous via terminal)
# ⚠️ LGPD: APENAS totais/agregados. NUNCA dado identificável de paciente.
# Dado identificável → orientar a usar a plataforma (nunca Telegram/WhatsApp).
#
# Uso:
#   garca.sh indicadores <unidade_id>
#   garca.sh censo <unidade_id>
#   garca.sh internacoes <unidade_id>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL não definida}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?chave não definida}"
AUTH="apikey: $SUPABASE_SERVICE_ROLE_KEY"
AUTH2="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

comando="${1:?uso: garca.sh <indicadores|censo|internacoes> [unidade_id]}"
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
  indicadores)
    unidade="${2:?unidade_id obrigatório}"
    api_cacheada "ind-$unidade" "vw_indicadores_unidade?select=unidade_id,unidade_nome,total_pacientes,prescricoes_assinadas,prescricoes_rascunho,receitas_retidas&unidade_id=eq.$unidade"
    ;;

  censo)
    unidade="${2:?unidade_id obrigatório}"
    api_cacheada "censo-$unidade" "censo_ocupacao?select=data,turno,internados,leitos_total,leitos_ocupados,leitos_livres,taxa_ocupacao&unidade_id=eq.$unidade&order=data.desc,turno.asc&limit=6"
    ;;

  internacoes)
    unidade="${2:?unidade_id obrigatório}"
    # APENAS contagem por status — nunca lista de pacientes
    api_cacheada "int-$unidade" "internacoes?select=status&unidade_id=eq.$unidade&limit=1000"
    ;;

  *)
    echo "comando desconhecido: $comando (indicadores|censo|internacoes)" >&2
    exit 1
    ;;
esac
