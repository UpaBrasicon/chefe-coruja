#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Biblioteca comum das skills da Corujinha — correções C1 e C2 da auditoria.
#
# C2 — VALIDAÇÃO DE ARGUMENTOS
# Os argumentos das skills são escritos pelo LLM a partir do que o usuário
# digita. Antes eles entravam crus na query string do PostgREST, então um
# valor como `x&unidade_id=neq.x` ou `x&select=*` quebrava o filtro de tenant
# ou ampliava as colunas retornadas: prompt injection virava injection de API.
# Aqui todo argumento passa por validador de formato ANTES de virar consulta.
#
# C1 — AUTORIZAÇÃO NO SERVIDOR
# `api_hermes` fala com POST /skill/consulta do backend, que resolve a
# identidade do usuário e aplica a guarda de papel no código. As skills que a
# usam NÃO precisam da SERVICE_ROLE_KEY.
#
# DEPENDÊNCIAS: python3 (montar/parsear JSON — jq NÃO é assumido: não existe
# no container do Nous nem no host da VPS), curl, sha256sum, stat.
#
# Uso: `source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"`
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Arquivos de cache podem conter dados de profissionais — não deixe legíveis
# para outros usuários da VPS (item A3 da auditoria).
umask 077

# ── Validadores (C2) ─────────────────────────────────────────────────────────
# Falham FECHADO: argumento fora do formato aborta o script, não vira consulta.

morrer() {
  echo "erro: $1" >&2
  exit 1
}

validar_uuid() {
  local valor="${1:-}" nome="${2:-argumento}"
  [[ "$valor" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
    || morrer "$nome inválido (esperado UUID)"
  printf '%s' "$valor"
}

# Palavra simples: enums como 'novo', 'em_acompanhamento', 'critico'.
validar_slug() {
  local valor="${1:-}" nome="${2:-argumento}"
  [[ "$valor" =~ ^[a-z_]{1,32}$ ]] || morrer "$nome inválido (esperado palavra simples)"
  printf '%s' "$valor"
}

# Enum fechado: o valor precisa estar na lista permitida.
validar_enum() {
  local valor="${1:-}" nome="${2:-argumento}"
  shift 2
  local permitido
  for permitido in "$@"; do
    if [ "$valor" = "$permitido" ]; then
      printf '%s' "$valor"
      return 0
    fi
  done
  morrer "$nome inválido (valores aceitos: $*)"
}

validar_inteiro() {
  local valor="${1:-}" nome="${2:-argumento}" max="${3:-365}"
  [[ "$valor" =~ ^[0-9]{1,4}$ ]] && [ "$valor" -ge 1 ] && [ "$valor" -le "$max" ] \
    || morrer "$nome inválido (inteiro entre 1 e $max)"
  printf '%s' "$valor"
}

# ── Cache em disco (privado ao usuário) ──────────────────────────────────────
# Diretório por UID e com permissão 700: antes ficava em /tmp compartilhado,
# onde outro processo podia ler as respostas ou envenenar o cache.

cache_init() {
  CACHE_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/gaviao-cache-$(id -u)"
  mkdir -p "$CACHE_DIR"
  chmod 700 "$CACHE_DIR"
}

# cache_ou_executa <ttl> <chave> <comando...>
cache_ou_executa() {
  local ttl="$1" chave="$2"
  shift 2
  cache_init
  local arquivo="$CACHE_DIR/$(printf '%s' "$chave" | sha256sum | cut -d' ' -f1)"
  if [ -f "$arquivo" ]; then
    local idade=$(( $(date +%s) - $(stat -c %Y "$arquivo" 2>/dev/null || echo 0) ))
    if [ "$idade" -lt "$ttl" ]; then
      cat "$arquivo"
      return 0
    fi
  fi
  local resposta
  resposta="$("$@")"
  printf '%s' "$resposta" > "$arquivo"
  printf '%s' "$resposta"
}

# ── JSON via python3 (sem jq) ────────────────────────────────────────────────
# Monta o corpo da requisição com escaping correto (nada de concat de string).
json_corpo() {
  # json_corpo <wa_id> <escopo> <comando> <args_json>
  python3 -c '
import json, sys
wa, esc, com = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    args = json.loads(sys.argv[4]) if sys.argv[4] else {}
except Exception:
    args = {}
print(json.dumps({"wa_id": wa, "escopo": esc, "comando": com, "args": args}, ensure_ascii=False))
' "$1" "$2" "$3" "$4"
}

# json_args <chave>=<valor> [...] — monta objeto JSON (valores string).
# Substitui `jq -nc --arg k "$v" '{k:$v}'`.
json_args() {
  python3 -c '
import json, sys
obj = {}
for item in sys.argv[1:]:
    chave, _, valor = item.partition("=")
    obj[chave] = valor
print(json.dumps(obj, ensure_ascii=False))
' "$@"
}

# json_args_num <chave>=<valor> [...] — monta objeto JSON (valores numéricos).
# Substitui `jq -nc --argjson k "$v" '{k:$v}'`.
json_args_num() {
  python3 -c '
import json, sys
obj = {}
for item in sys.argv[1:]:
    chave, _, valor = item.partition("=")
    try:
        obj[chave] = int(valor)
    except ValueError:
        obj[chave] = float(valor)
print(json.dumps(obj, ensure_ascii=False))
' "$@"
}

# json_adiciona <json> <chave>=<valor> [...] — devolve o objeto original com
# os campos adicionados/sobrescritos. Substitui `jq -c ". + {k:\$v}"`.
json_adiciona() {
  local json="$1"
  shift
  python3 -c '
import json, sys
obj = json.loads(sys.argv[1])
for item in sys.argv[2:]:
    chave, _, valor = item.partition("=")
    obj[chave] = valor
print(json.dumps(obj, ensure_ascii=False))
' "$json" "$@"
}

# json_resumo_health — resume /health em {status, redis, supabase, uptime}.
# Substitui `jq -c "{status, redis, supabase, uptime: (.uptime | floor)}"`.
json_resumo_health() {
  python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
out = {
    "status": d.get("status"),
    "redis": d.get("redis"),
    "supabase": d.get("supabase"),
    "uptime": int(d.get("uptime") or 0),
}
print(json.dumps(out, ensure_ascii=False))
'
}

# Extrai um campo simples (.dados ou .resposta) de um JSON lido do stdin.
# JSON inválido/vazio → imprime "null" (nunca quebra o pipeline).
json_pega() {
  # json_pega <campo>
  python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = None
campo = sys.argv[1].lstrip(".")
v = d
for parte in campo.split("."):
    v = v.get(parte) if isinstance(v, dict) else None
print("null" if v is None else json.dumps(v, ensure_ascii=False))
' "$1"
}

# ── Chamada ao backend Hermes (C1) ───────────────────────────────────────────
# A guarda de papel é aplicada no servidor. O script não decide nada.
#
# Env obrigatórias (injetadas pelo processo do Nous, não pelo LLM):
#   HERMES_BACKEND_URL   ex.: http://localhost:3000
#   HERMES_SKILL_TOKEN   token da skill API
#   CORUJA_WA_ID         telefone/identificador da sessão em curso

api_hermes() {
  local escopo="$1" comando="$2" args_json="${3:-{\}}"

  local base="${HERMES_BACKEND_URL:-http://localhost:3000}"
  local token="${HERMES_SKILL_TOKEN:?HERMES_SKILL_TOKEN não definido}"
  local wa_id="${CORUJA_WA_ID:?CORUJA_WA_ID não definido (sessão sem usuário identificado)}"

  local corpo resposta http
  corpo="$(json_corpo "$wa_id" "$escopo" "$comando" "$args_json")"

  resposta="$(curl -s -m 15 -w '\n%{http_code}' \
    -X POST "$base/skill/consulta" \
    -H "x-skill-token: $token" \
    -H 'Content-Type: application/json' \
    -d "$corpo")" || morrer "backend inacessível"

  http="$(printf '%s' "$resposta" | tail -n1)"
  local json
  json="$(printf '%s' "$resposta" | sed '$d')"

  case "$http" in
    200) printf '%s' "$json" | json_pega 'dados' ;;
    403)
      # Não autorizado: devolve a MENSAGEM GENÉRICA para o agente repetir,
      # sem revelar que existe uma ferramenta restrita por trás.
      local msg
      msg="$(printf '%s' "$json" | json_pega 'resposta')"
      python3 -c '
import json, sys
msg = sys.argv[1]
print(json.dumps({"mensagem": msg} if msg != "null" else {"mensagem": "Não encontrei informações."}, ensure_ascii=False))
' "$msg"
      ;;
    401) morrer "token da skill rejeitado pelo backend" ;;
    503) morrer "skill api não configurada no backend" ;;
    *)   morrer "backend respondeu HTTP $http" ;;
  esac
}
