"""Expressão regular do JavaScript (sem a flag ``u``) rodando no ``re`` do Python.

Os padrões do Gavião e do Cérbero vêm copiados LITERALMENTE de
hermes/src/jobs/padroes-injection.ts e gaviao.ts (o teste confere com o
arquivo TS). As diferenças de sentido entre os dois motores são tratadas aqui:
- ``\\b`` e ``\\w`` do JS são só ASCII (no Python seriam Unicode: "ó" contaria
  como letra e a fronteira mudaria);
- ``\\d`` do JS é só 0-9;
- ``\\s`` do JS tem um conjunto próprio (inclui U+FEFF, não inclui U+001C..1F);
- ``.`` do JS não casa \\n, \\r, U+2028 e U+2029.
A flag ``i`` vira ``re.IGNORECASE`` (Unicode nos dois para as letras latinas).
"""

from __future__ import annotations

import re

_W = "A-Za-z0-9_"
_S = "\\t\\n\\x0b\\x0c\\r \\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
_FRONTEIRA = f"(?:(?<=[{_W}])(?![{_W}])|(?<![{_W}])(?=[{_W}]))"
_NAO_FRONTEIRA = f"(?:(?<=[{_W}])(?=[{_W}])|(?<![{_W}])(?![{_W}]))"
_PONTO = "[^\\n\\r\\u2028\\u2029]"


def traduzir(fonte: str) -> str:
    saida: list[str] = []
    i = 0
    em_classe = False
    while i < len(fonte):
        c = fonte[i]
        if c == "\\" and i + 1 < len(fonte):
            n = fonte[i + 1]
            i += 2
            if em_classe:
                saida.append({"d": "0-9", "s": _S, "w": _W}.get(n, "\\" + n))
                if n in "DSW":
                    raise ValueError(f"classe negada dentro de [] não suportada: \\{n}")
            else:
                saida.append({
                    "b": _FRONTEIRA, "B": _NAO_FRONTEIRA,
                    "d": "[0-9]", "D": "[^0-9]",
                    "s": f"[{_S}]", "S": f"[^{_S}]",
                    "w": f"[{_W}]", "W": f"[^{_W}]",
                }.get(n, "\\" + n))
            continue
        if em_classe:
            if c == "]":
                em_classe = False
                saida.append(c)
            elif c == "[":
                saida.append("\\[")  # literal no JS; no Python seria aviso de conjunto aninhado
            else:
                saida.append(c)
        elif c == "[":
            em_classe = True
            saida.append(c)
            if fonte[i + 1: i + 2] == "^":
                saida.append("^")
                i += 1
        elif c == ".":
            saida.append(_PONTO)
        else:
            saida.append(c)
        i += 1
    return "".join(saida)


def js_regex(fonte: str, flags: str = "") -> re.Pattern:
    """Compila ``/fonte/flags``. Só ``i`` é aceita (é o que os padrões usam)."""
    if set(flags) - {"i"}:
        raise ValueError(f"flag não suportada: {flags}")
    return re.compile(traduzir(fonte), re.IGNORECASE if "i" in flags else 0)
