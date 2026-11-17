"""Chaves da biblioteca (S8 D8: comparação em tempo constante).

LG6, decisão I5 = A do RT (17/11/2026,
docs/regulatorio/LG6-IA-DADO-SAUDE-DIAGNOSTICO.md): o /v1/ask, o único caminho
da biblioteca que chama o modelo de linguagem, aceita só a chave da Edge
`clinical-search` (BIBLIOTECA_ASK_KEY). A chave única (BIBLIOTECA_API_KEY),
que o Nous e o gateway do Hermes também têm, deixa de abrir o /v1/ask. Assim
toda pergunta ao modelo passa pela liberação da Edge (liberar.ts).

Sem BIBLIOTECA_ASK_KEY configurada vale a chave única (transição; ver
infra/biblioteca-chave-ask.md).
"""
import hmac
from collections.abc import Mapping


def confere(h: str | None, chave: str | None) -> bool:
    return bool(h) and bool(chave) and hmac.compare_digest(h.encode(), f"Bearer {chave}".encode())


def chave_geral(env: Mapping[str, str]) -> str | None:
    return env.get("BIBLIOTECA_API_KEY")


def chave_ask(env: Mapping[str, str]) -> str | None:
    return env.get("BIBLIOTECA_ASK_KEY") or env.get("BIBLIOTECA_API_KEY")
