#!/bin/sh
# Liga a LEITURA de skills nas quatro Corujas de saúde (decisão do RT,
# 03/10/2026): elas passam a ver as skills que o maestro (Coruja Lab) propôs e
# o RT aprovou, instaladas em skills/maestro/. Criar, editar e apagar skill,
# terminal e arquivos continuam bloqueados pela trava do plugin chefe-coruja
# (gancho pre_tool_call): por isso o plugin novo é copiado junto.
#
# Uso, NA VPS, como root, na pasta onde está o plugin novo:
#   sh ligar-skills-leitura.sh /caminho/do/plugin/chefe-coruja
set -eu
PLUGIN="${1:?informe a pasta do plugin chefe-coruja novo}"
[ -f "$PLUGIN/__init__.py" ] || { echo "plugin não encontrado em $PLUGIN" >&2; exit 1; }
grep -q "_trava_ferramentas" "$PLUGIN/__init__.py" || { echo "esse plugin não tem a trava de ferramentas: abortado" >&2; exit 1; }

for par in "/home/hermes/.hermes:hermes-agent" "/home/hermes/.hermes-gestora:hermes-agent-gestora" \
           "/home/hermes/.hermes-clinica:hermes-agent-clinica" "/home/hermes/.hermes-suporte:hermes-agent-suporte"; do
  DIR="${par%%:*}"; CONT="${par##*:}"
  [ -f "$DIR/config.yaml" ] || { echo "pulado (sem config): $DIR"; continue; }
  cp "$DIR/config.yaml" "$DIR/config.yaml.bak-skills-$(date +%Y%m%d%H%M)"
  rm -rf "$DIR/plugins/chefe-coruja.novo"
  cp -r "$PLUGIN" "$DIR/plugins/chefe-coruja.novo"
  rm -rf "$DIR/plugins/chefe-coruja" && mv "$DIR/plugins/chefe-coruja.novo" "$DIR/plugins/chefe-coruja"
  mkdir -p "$DIR/skills/maestro"
  python3 - "$DIR/config.yaml" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
m = re.search(r"(platform_toolsets:\n(?:  .*\n|    .*\n)*?  telegram:\n)((?:    - .*\n)+)", s)
if not m:
    sys.exit("platform_toolsets.telegram não encontrado em " + p)
itens = m.group(2)
if "    - skills\n" not in itens:
    s = s[:m.end(2)] + "    - skills\n" + s[m.end(2):]
# escrita de skill pelo agente nunca é aceita (a trava bloqueia); a aprovação do Nous fica ligada por garantia
if re.search(r"^skills:\n", s, re.M):
    if "write_approval:" in s:
        s = re.sub(r"(^skills:\n(?:  .*\n)*?  write_approval:) .*", r"\1 true", s, count=1, flags=re.M)
    else:
        s = re.sub(r"^skills:\n", "skills:\n  write_approval: true\n", s, count=1, flags=re.M)
else:
    s += "\nskills:\n  write_approval: true\n"
open(p, "w").write(s)
print(p, "telegram:", re.search(r"  telegram:\n((?:    - .*\n)+)", s).group(1).split()[1::2])
PY
  chown -R --reference="$DIR" "$DIR/plugins" "$DIR/skills" "$DIR/config.yaml"
  docker restart "$CONT" >/dev/null && echo "reiniciado: $CONT"
done
echo "pronto. As skills aprovadas entram com aplicar-propostas.sh (pasta nous-lab)."
