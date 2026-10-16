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


# ── Vocabulário clínico (decisão do RT em 15/10/2026) ─────────────────────────
# O NER marcava palavras médicas raras como nome de pessoa: "anafilaxa
# adrenalina" virava "[PESSOA]" e "hantavirose síndrome cardiopulmonar conduta"
# virava "[PESSOA] conduta" — a busca perdia a palavra-chave. Uma entidade só
# deixa de ser mascarada quando TODAS as suas palavras estão no vocabulário da
# própria biblioteca (fichas da Central, ferramentas, siglas e
# vocabulario-clinico.txt) ou são erro de digitação de uma palavra longa dele.
# Nome comum de gente nunca entra no vocabulário. Risco aceito pelo RT: um
# sobrenome igual a um escore (Wells, Glasgow) no meio da frase não é mascarado.
NOMES_COMUNS = set("""
maria jose joao ana antonio francisco carlos paulo pedro lucas luiz luis marcos gabriel rafael daniel marcelo bruno
eduardo felipe raimundo rodrigo manoel manuel mateus matheus andre fernando fabio leonardo gustavo guilherme leandro
tiago thiago sebastiao ricardo vitor victor diego anderson adriana juliana marcia fernanda patricia aline sandra
camila amanda bruna jessica leticia julia luciana vanessa mariana gabriela vera beatriz larissa rita claudia
francisca antonia adriano alexandre cristiane simone renata debora raquel carla tatiana silvia sonia regina helena
joana josefa luzia rosa lucia terezinha teresa jorge sergio roberto cesar mario rubens wagner wellington washington
silva santos oliveira souza sousa pereira lima costa ferreira rodrigues almeida carvalho gomes martins araujo ribeiro
barbosa rocha dias nascimento alves moreira cardoso teixeira correia castro pinto ramos mendes freitas vieira monteiro
""".split())
_STOP = set("de da do das dos e em no na com por para a o as os".split())
_VOCAB: tuple[float, set[str], dict[int, list[str]]] | None = None
_VOCAB_TTL_S = 600


def _plano(s: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def _palavras(s: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9][a-z0-9-]*", _plano(s)) if len(w) >= 3 and w not in _STOP]


def _carregar_vocabulario() -> set[str]:
    import json
    from pathlib import Path
    base = Path(os.environ.get("BIBLIOTECA_DIR", "/srv/biblioteca"))
    v: set[str] = set()
    try:
        from siglas import SIGLAS
        for k, val in SIGLAS.items():
            v.update(_palavras(k)); v.update(_palavras(val))
    except Exception:
        pass
    try:
        for t in json.loads((base / "ferramentas.json").read_text(encoding="utf-8")):
            for campo in ("id", "nome", "categoria", "descricao"):
                v.update(_palavras(str(t.get(campo) or "").replace("-", " ")))
                v.update(_palavras(str(t.get(campo) or "")))
            for s in t.get("sinonimos") or []:
                v.update(_palavras(s))
    except Exception:
        pass
    try:
        for linha in (base / "vocabulario-clinico.txt").read_text(encoding="utf-8").splitlines():
            if linha.strip() and not linha.startswith("#"):
                v.update(_palavras(linha))
    except Exception:
        pass
    try:
        for arq in (base / "corpus").glob("*.md"):
            md = re.sub(r"^---\r?\n.*?\r?\n---\r?\n", "", arq.read_text(encoding="utf-8"), count=1, flags=re.S)
            for linha in md.splitlines():
                # citação de autor não entra (sobrenomes de gente)
                if re.search(r"fonte declarada|isbn|et al|doi|https?://|\b(19|20)\d\d\b.*;", linha, re.I):
                    continue
                v.update(_palavras(linha))
    except Exception:
        pass
    return v - NOMES_COMUNS


def _vocabulario() -> tuple[set[str], dict[int, list[str]]]:
    global _VOCAB
    import time
    if _VOCAB is None or time.time() - _VOCAB[0] > _VOCAB_TTL_S:
        v = _carregar_vocabulario()
        por_tamanho: dict[int, list[str]] = {}
        for w in v:
            if len(w) >= 6:
                por_tamanho.setdefault(len(w), []).append(w)
        _VOCAB = (time.time(), v, por_tamanho)
    return _VOCAB[1], _VOCAB[2]


def _distancia_ate(a: str, b: str, limite: int) -> int:
    """Levenshtein com parada antecipada (só precisa saber se é <= limite)."""
    if abs(len(a) - len(b)) > limite:
        return limite + 1
    ant = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        atual = [i]
        for j, cb in enumerate(b, 1):
            atual.append(min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (ca != cb)))
        if min(atual) > limite:
            return limite + 1
        ant = atual
    return ant[-1]


def palavra_clinica(w: str) -> bool:
    w = _plano(w)
    if w in NOMES_COMUNS:
        return False
    vocab, por_tamanho = _vocabulario()
    if w in vocab:
        return True
    # erro de digitação de palavra longa do vocabulário ("anafilaxa" → "anafilaxia")
    if len(w) >= 7:
        limite = 2 if len(w) >= 10 else 1
        for n in range(len(w) - limite, len(w) + limite + 1):
            for cand in por_tamanho.get(n, ()):
                if _distancia_ate(w, cand, limite) <= limite:
                    return True
    return False


def entidade_clinica(texto: str) -> bool:
    """True quando todas as palavras da entidade são do vocabulário clínico."""
    ws = _palavras(texto)
    return bool(ws) and all(palavra_clinica(w) for w in ws)


def nomes_proprios(t: str) -> list[str]:
    """Nomes de pessoa detectados pelo NER (vazio se o modelo não estiver presente),
    sem as entidades que são só vocabulário clínico."""
    nlp = _nlp()
    if not nlp or not t:
        return []
    try:
        doc = nlp(t)
        achados = {
            e.text.strip()
            for e in doc.ents
            if e.label_ in ("PER", "PESSOA", "PERSON") and len(e.text.strip()) >= 3
            and not entidade_clinica(e.text)
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
