"""Pseudonimização (regra R5): a pergunta nunca chega ao modelo nem ao log com
dado identificável. A Edge Function faz a mesma coisa antes de chamar aqui."""
import re

PADROES = [
    (r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "[CPF]"),
    (r"\b\d{15}\b", "[CNS]"),
    (r"\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b", "[TEL]"),
    (r"\b\d{2}/\d{2}/\d{4}\b", "[DATA]"),
    (r"\b(prontu[aá]rio|registro|leito|atendimento)\s*n?[ºo°.]?\s*\d+\b", "[ID]"),
    (r"\b[\w.+-]+@[\w-]+\.[\w.]+\b", "[EMAIL]"),
]


def pseudonimizar(t: str) -> str:
    for p, s in PADROES:
        t = re.sub(p, s, t, flags=re.IGNORECASE)
    return t
