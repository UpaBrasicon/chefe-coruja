"""Chaves da biblioteca (S8 D8: comparação em tempo constante).

LG6, decisão I5 = A do RT (17/11/2026,
docs/regulatorio/LG6-IA-DADO-SAUDE-DIAGNOSTICO.md): o /v1/ask, o único caminho
da biblioteca que chama o modelo de linguagem, só abre com a chave da Edge
`clinical-search` (BIBLIOTECA_API_KEY). O Hermes e o Nous passam a usar uma
chave interna (BIBLIOTECA_INTERNA_KEY), que abre /v1/search, /v1/deid e
/health, mas não o /v1/ask. Assim toda pergunta ao modelo passa pela
liberação da Edge (liberar.ts).

Enquanto o Hermes e o Nous ainda tiverem a chave da Edge, eles continuam
abrindo tudo (transição; ver infra/biblioteca-chave-ask.md).
"""
import hmac
from collections.abc import Mapping


def confere(h: str | None, chave: str | None) -> bool:
    return bool(h) and bool(chave) and hmac.compare_digest(h.encode(), f"Bearer {chave}".encode())


def rota_geral(h: str | None, env: Mapping[str, str]) -> bool:
    """/v1/search, /v1/deid: chave da Edge ou chave interna."""
    return confere(h, env.get("BIBLIOTECA_API_KEY")) or confere(h, env.get("BIBLIOTECA_INTERNA_KEY"))


def rota_ask(h: str | None, env: Mapping[str, str]) -> bool:
    """/v1/ask: só a chave da Edge."""
    return confere(h, env.get("BIBLIOTECA_API_KEY"))
