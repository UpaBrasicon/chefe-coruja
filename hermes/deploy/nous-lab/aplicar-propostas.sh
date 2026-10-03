#!/bin/sh
# Instala nas Corujas de saúde as skills APROVADAS pelo RT no maestro da Coruja Lab
# (decisão do RT, 03/10/2026). A Lab só propõe; aprovar no Telegram só muda o
# status; quem instala é este script, no host, com confirmação humana.
#
# Uso, NA VPS, como root, de dentro desta pasta (precisa de plugins/maestro):
#   sh aplicar-propostas.sh                      instala as aprovadas (pergunta s/N uma a uma)
#   sh aplicar-propostas.sh --remover <agente> <nome>   desinstala uma skill do maestro
#
# Para cada /home/hermes/.hermes-lab/maestro/propostas/*/proposta.json com
# status "aprovada" (as já "aplicada" ficam de fora):
#   1. valida de novo (plugins/maestro/__init__.py validar): só SKILL.md na
#      pasta, tamanho, frontmatter name = nome, agente válido, nada de dado
#      pessoal/ferramenta proibida/dose, sha256 igual ao da aprovação e
#      aprovada_por dentro do TELEGRAM_ALLOWED_USERS do hermes-agent;
#   2. mostra o resumo e as 20 primeiras linhas e pergunta s/N (de /dev/tty);
#   3. copia para <home do agente>/skills/maestro/<nome>/SKILL.md, com o dono
#      da pasta do agente; marca "aplicada" e reinicia o contêiner do agente.
# IMPORTANTE: a Lab tem terminal e escreve na própria pasta; o status
# "aprovada" sozinho não prova nada. A conferência humana (passo 2) é a trava.
# Não mostra ambiente nem tokens.
set -eu
umask 077
AQUI="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$AQUI/plugins/maestro/__init__.py"
LAB=/home/hermes/.hermes-lab
PROPOSTAS="$LAB/maestro/propostas"

falha() { echo "$*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || falha "rode como root"
[ -f "$PLUGIN" ] || falha "falta $PLUGIN (rode de dentro da pasta nous-lab)"
[ -r /dev/tty ] || falha "precisa de terminal interativo (/dev/tty) para confirmar"

home_do() {
  case "$1" in
    corujinha) echo /home/hermes/.hermes ;;
    gestora|clinica|suporte) echo "/home/hermes/.hermes-$1" ;;
    *) return 1 ;;
  esac
}
conteiner_do() {
  case "$1" in
    corujinha) echo hermes-agent ;;
    *) echo "hermes-agent-$1" ;;
  esac
}
nome_valido() { printf '%s' "$1" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$' && [ ${#1} -ge 3 ] && [ ${#1} -le 48 ]; }
confirmar() {
  printf '%s [s/N] ' "$1" > /dev/tty
  read -r R < /dev/tty || R=""
  case "$R" in s|S|sim|SIM|y|Y) return 0 ;; *) return 1 ;; esac
}
reiniciar() {
  C=$(conteiner_do "$1")
  if docker inspect "$C" >/dev/null 2>&1; then
    docker restart "$C" >/dev/null && echo "  $C reiniciado"
  else
    echo "  AVISO: contêiner $C não encontrado; a skill vale no próximo início" >&2
  fi
}
avisar_toolset() {
  # a Coruja só enxerga skills com o toolset "skills" no Telegram
  CFG="$1/config.yaml"
  if [ -f "$CFG" ] && ! python3 - "$CFG" <<'PY'
import re, sys
s = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"  telegram:\n((?:    - .*\n)+)", s)
sys.exit(0 if m and "    - skills\n" in m.group(1) else 1)
PY
  then
    echo "  AVISO: $CFG não tem 'skills' em platform_toolsets.telegram: a Coruja não vai ler a skill" >&2
  fi
}

# ── remoção ──────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--remover" ]; then
  [ $# -eq 3 ] || falha "uso: sh aplicar-propostas.sh --remover <agente> <nome>"
  AG="$2"; NOME="$3"
  H=$(home_do "$AG") || falha "agente inválido: use corujinha, gestora, clinica ou suporte"
  nome_valido "$NOME" || falha "nome inválido (kebab-case, 3 a 48)"
  ALVO="$H/skills/maestro/$NOME"
  [ -d "$ALVO" ] || falha "não instalada: $ALVO"
  confirmar "Remover a skill $NOME de $AG ($ALVO)?" || { echo "nada removido"; exit 0; }
  rm -rf "$ALVO"
  echo "removida: $ALVO"
  if [ -d "$PROPOSTAS" ]; then
    python3 -B "$PLUGIN" removidas "$PROPOSTAS" "$AG" "$NOME" | while read -r P; do
      chown --reference="$LAB" "$P"; echo "  marcada como removida: $(basename "$(dirname "$P")")"
    done
  fi
  reiniciar "$AG"
  exit 0
fi
[ $# -eq 0 ] || falha "uso: sh aplicar-propostas.sh  |  sh aplicar-propostas.sh --remover <agente> <nome>"

# ── aprovadores: o TELEGRAM_ALLOWED_USERS do hermes-agent (não é mostrado) ──
APROV=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hermes-agent \
  | grep '^TELEGRAM_ALLOWED_USERS=' | head -n1 | cut -d= -f2- | tr -d ' \r') || APROV=""
[ -n "$APROV" ] || falha "não achei TELEGRAM_ALLOWED_USERS no hermes-agent: sem lista de aprovadores, nada é instalado"

[ -d "$PROPOSTAS" ] || { echo "nenhuma proposta ($PROPOSTAS não existe)"; exit 0; }

APLICADAS=0; PULADAS=0; INVALIDAS=0
for J in "$PROPOSTAS"/*/proposta.json; do
  [ -f "$J" ] || continue
  P=$(dirname "$J")
  ST=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("status", ""))' "$J" 2>/dev/null) || ST="?"
  [ "$ST" = "aprovada" ] || continue
  echo
  echo "== $(basename "$P")"
  if ! LINHA=$(python3 -B "$PLUGIN" validar "$P" "$APROV"); then
    echo "  RECUSADA na validação (fica como está)"; INVALIDAS=$((INVALIDAS + 1)); continue
  fi
  AG=${LINHA%% *}; NOME=${LINHA#* }
  # dupla checagem do que veio do python antes de montar caminho
  H=$(home_do "$AG") || { echo "  agente inválido"; INVALIDAS=$((INVALIDAS + 1)); continue; }
  nome_valido "$NOME" || { echo "  nome inválido"; INVALIDAS=$((INVALIDAS + 1)); continue; }
  python3 -B "$PLUGIN" mostrar "$P"
  DEST="$H/skills/maestro/$NOME"
  [ -e "$DEST/SKILL.md" ] && echo "  (vai SUBSTITUIR a skill já instalada em $DEST)"
  if ! confirmar "  Instalar em $AG ($DEST)?"; then
    echo "  pulada (continua aprovada)"; PULADAS=$((PULADAS + 1)); continue
  fi
  mkdir -p "$DEST"
  cp "$P/SKILL.md" "$DEST/SKILL.md.novo" && mv -f "$DEST/SKILL.md.novo" "$DEST/SKILL.md"
  chown --reference="$H" "$H/skills"
  chown -R --reference="$H" "$H/skills/maestro"
  chmod 700 "$DEST"; chmod 600 "$DEST/SKILL.md"
  python3 -B "$PLUGIN" marcar "$P" aplicada
  chown --reference="$LAB" "$J"
  echo "  instalada: $DEST"
  avisar_toolset "$H"
  reiniciar "$AG"
  APLICADAS=$((APLICADAS + 1))
done
echo
echo "fim: $APLICADAS instalada(s), $PULADAS pulada(s), $INVALIDAS recusada(s) na validação"
