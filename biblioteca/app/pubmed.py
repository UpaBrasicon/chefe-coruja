"""PubMed ao vivo quando o material da biblioteca não responde (trilha Hermes /
Evidências, E5; decisão do RT de 12/11/2026, opção A).

- Só uma lista de artigos: título, revista, ano, tipo e link pelo PMID.
- O modelo NÃO escreve resposta a partir dos resumos. Ele só reescreve a
  pergunta (já pseudonimizada, E2) como busca do PubMed em inglês.
- Nada é guardado: sem cache e sem gravar no corpus.
- Filtro: diretrizes, revisões sistemáticas, metanálises e revisões dos
  últimos 10 anos, as mais relevantes primeiro.
- A NCBI limita a 3 chamadas por segundo sem chave; cada pergunta faz 2.
"""
import json
import os
import re

import httpx

E = os.environ
PUBMED = E.get("PUBMED", "1") != "0"
TIMEOUT_S = float(E.get("PUBMED_TIMEOUT_S", 6))
MAXIMO = int(E.get("PUBMED_MAX", 5))
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
FERRAMENTA = "chefe-coruja-biblioteca"
TIPOS = ('("practice guideline"[pt] OR guideline[pt] OR "systematic review"[pt] OR "meta-analysis"[pt] OR review[pt])')
CRIANCA = '(child[mh] OR infant[mh] OR adolescent[mh])'

SYSTEM_PUBMED = """Reescreva a pergunta clínica de um médico de pronto-socorro como uma busca do PubMed em inglês: só os termos (de preferência MeSH), ligados por AND e OR, sem aspas desnecessárias, sem filtro de data ou de tipo de estudo e sem explicação. Uma linha só. Se não for uma pergunta clínica, responda exatamente FORA."""


def termos_pubmed(q: str, llm, modelo: str, extra: dict | None = None, timeout: float = 8.0):
    """(busca em inglês ou None, (modelo, usage) ou None)."""
    try:
        r = llm.with_options(timeout=timeout, max_retries=0).chat.completions.create(
            model=modelo, temperature=0, max_tokens=200, extra_body=extra or {},
            messages=[{"role": "system", "content": SYSTEM_PUBMED}, {"role": "user", "content": q}])
    except Exception:  # noqa: BLE001 — sem tradução, sem lista
        return None, None
    uso = (getattr(r, "model", None) or modelo, getattr(r, "usage", None))
    t = re.sub(r"\s+", " ", (r.choices[0].message.content or "")).strip().strip("`")
    if not t or t.upper().startswith("FORA") or len(t) > 400:
        return None, uso
    return t, uso


def consulta_completa(termos: str, pediatrico: bool) -> str:
    partes = [f"({termos})", TIPOS] + ([CRIANCA] if pediatrico else [])
    return " AND ".join(partes)


def _ano(pubdate: str) -> int | None:
    m = re.match(r"(\d{4})", pubdate or "")
    return int(m.group(1)) if m else None


def _tipo(pubtypes: list) -> str:
    t = [p.lower() for p in pubtypes or []]
    if any("guideline" in p for p in t):
        return "diretriz"
    if "meta-analysis" in t:
        return "metanálise"
    if "systematic review" in t:
        return "revisão sistemática"
    if "review" in t:
        return "revisão"
    return "artigo"


def buscar(termos: str, pediatrico: bool, cliente=httpx) -> list[dict]:
    """Até MAXIMO artigos; lista vazia se a NCBI não responder."""
    try:
        r = cliente.get(f"{EUTILS}/esearch.fcgi", timeout=TIMEOUT_S, params={
            "db": "pubmed", "term": consulta_completa(termos, pediatrico), "retmax": MAXIMO, "sort": "relevance",
            "datetype": "pdat", "reldate": 3650, "retmode": "json", "tool": FERRAMENTA})
        r.raise_for_status()
        ids = r.json().get("esearchresult", {}).get("idlist", [])[:MAXIMO]
        if not ids:
            return []
        s = cliente.get(f"{EUTILS}/esummary.fcgi", timeout=TIMEOUT_S, params={
            "db": "pubmed", "id": ",".join(ids), "retmode": "json", "tool": FERRAMENTA})
        s.raise_for_status()
        res = s.json().get("result", {})
    except Exception:  # noqa: BLE001 — PubMed fora: a tela fica só com "não encontrei"
        return []
    artigos = []
    for pmid in ids:
        a = res.get(pmid) or {}
        titulo = re.sub(r"\s+", " ", a.get("title") or "").strip()
        if not titulo:
            continue
        artigos.append({"pmid": pmid, "titulo": titulo[:300], "revista": (a.get("fulljournalname") or a.get("source") or "")[:200],
                        "ano": _ano(a.get("pubdate", "")), "tipo": _tipo(a.get("pubtype", [])),
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"})
    return artigos


def evento(artigos: list[dict], termos: str) -> str:
    """Linha do stream: a tela mostra a lista com o aviso de que é PubMed ao vivo, fora do material."""
    return json.dumps({"type": "pubmed", "origem": "PubMed ao vivo", "busca": termos, "artigos": artigos}, ensure_ascii=False) + "\n"
