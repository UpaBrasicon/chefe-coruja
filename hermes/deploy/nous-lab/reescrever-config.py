"""Reescreve o config.yaml copiado da Corujinha para a Coruja Lab (usado pelo criar-lab.sh).

Mesmo método de antes (expressão regular, sem PyYAML, que o host pode não ter):
- Telegram com skills, terminal, arquivos, lista de tarefas, o organizador de
  skills e o maestro;
- plugins ligados: rtk-rewrite, lab-skills e maestro (o chefe-coruja NÃO entra).
Se não achar os blocos esperados, para com erro (não grava config pela metade).
Uso: python3 reescrever-config.py <config.yaml>
"""

import re
import sys

TELEGRAM = ["skills", "terminal", "file", "todo", "lab-skills", "maestro"]
PLUGINS = ["rtk-rewrite", "lab-skills", "maestro"]


def reescrever(s: str) -> str:
    itens_tg = "".join(f"    - {x}\n" for x in TELEGRAM)
    s, n1 = re.subn(r"(platform_toolsets:\n(?:  .*\n|    .*\n)*?  telegram:\n)(    - .*\n)+", lambda m: m.group(1) + itens_tg, s, count=1)
    itens_pl = "".join(f"    - {x}\n" for x in PLUGINS)
    s, n2 = re.subn(r"plugins:\n  enabled:\n(    - .*\n)+", lambda m: "plugins:\n  enabled:\n" + itens_pl, s, count=1)
    if n1 != 1 or n2 != 1:
        raise ValueError("config.yaml fora do formato esperado (platform_toolsets.telegram / plugins.enabled)")
    return s


def main(caminho: str) -> None:
    with open(caminho, encoding="utf-8") as f:
        s = reescrever(f.read())
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(s)
    print("config: telegram =", re.search(r"  telegram:\n((?:    - .*\n)+)", s).group(1).split())


if __name__ == "__main__":
    try:
        main(sys.argv[1])
    except (IndexError, OSError, ValueError) as e:
        print(f"reescrever-config: {e}", file=sys.stderr)
        sys.exit(1)
