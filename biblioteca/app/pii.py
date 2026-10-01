"""Pseudonimização (regra R5): a pergunta nunca chega ao modelo nem ao log com
dado identificável. A Edge Function faz a mesma coisa antes de chamar aqui.

Red-team V5: além dos padrões regex (documentos/contatos/datas), um passo de
NER (reconhecimento de nome próprio PT-BR via spaCy) mascara nomes de pessoa em
prosa que a regex não pega ("a maria do leito 3"). O NER é opcional e
**fail-safe**: se o modelo não estiver instalado (ou NER_DESLIGADO=1), o módulo
cai de volta só na regex — nada quebra. A exposição do serviço `/v1/deid`
(main.py) deixa os gateways (clinical-search, Hermes) usarem o mesmo NER antes
do egress, com fail-closed quando um nome é encontrado.
"""
import os
import re

PADROES = [
    (r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "[CPF]"),
    (r"\b\d{15}\b", "[CNS]"),
    (r"\b\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b", "[TEL]"),
    (r"\b\d{2}/\d{2}/\d{4}\b", "[DATA]"),
    (r"\b(prontu[aá]rio|registro|leito|atendimento)\s*n?[ºo°.]?\s*\d+\b", "[ID]"),
    (r"\b[\w.+-]+@[\w-]+\.[\w.]+\b", "[EMAIL]"),
]

_NER_OFF = os.environ.get("NER_DESLIGADO") == "1"
_NLP = None  # None = ainda não tentou; False = indisponível; objeto = carregado


def _nlp():
    """Carrega o spaCy PT uma vez. Fail-safe: ausência do modelo => sem NER."""
    global _NLP
    if _NLP is None:
        if _NER_OFF:
            _NLP = False
        else:
            try:
                import spacy  # type: ignore

                # Sem `disable`: o pt_core_news_sm não tem "tagger" e disable de
                # componente inexistente faz o load lançar (e cair no fail-safe,
                # desligando o NER sem querer). Carrega completo — custa ~1s.
                _NLP = spacy.load("pt_core_news_sm")
            except Exception:
                _NLP = False
    return _NLP or None


def ner_disponivel() -> bool:
    """True se o modelo spaCy carregou (para diagnóstico do /v1/deid)."""
    return _nlp() is not None


def nomes_proprios(t: str) -> list[str]:
    """Nomes de pessoa detectados pelo NER (vazio se o modelo não estiver presente)."""
    nlp = _nlp()
    if not nlp or not t:
        return []
    try:
        doc = nlp(t)
        achados = {
            e.text.strip()
            for e in doc.ents
            if e.label_ in ("PER", "PESSOA", "PERSON") and len(e.text.strip()) >= 3
        }
        return sorted(achados)
    except Exception:
        return []


def _mascarar_nomes(t: str, nomes: list[str]) -> str:
    for nome in sorted(nomes, key=len, reverse=True):
        t = re.sub(r"(?<!\w)" + re.escape(nome) + r"(?!\w)", "[PESSOA]", t)
    return t


def pseudonimizar(t: str) -> str:
    """Regex (documentos/contatos) + NER (nomes próprios). Fail-safe no NER."""
    for p, s in PADROES:
        t = re.sub(p, s, t, flags=re.IGNORECASE)
    nomes = nomes_proprios(t)
    if nomes:
        t = _mascarar_nomes(t, nomes)
    return t
