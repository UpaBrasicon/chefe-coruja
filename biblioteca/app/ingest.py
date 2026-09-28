"""Fontes -> chunks por seção -> embeddings (Ollama bge-m3) -> Qdrant.

Aceita PDF (pymupdf4llm, página a página) e Markdown (corpus da Central, um
arquivo por ferramenta). Toda fonte precisa de `licenca` válida em
fontes.yaml (regra R4); sem isso o script para antes de ler o arquivo.

Uso (dentro do container da API, que já tem as dependências):
  docker compose run --rm api python ingest.py            # todas as fontes
  docker compose run --rm api python ingest.py corpus     # só a pasta corpus
  docker compose run --rm api python ingest.py ms_dengue_2024.pdf
"""
import hashlib
import os
import re
import sys
from pathlib import Path

import httpx
import yaml
from qdrant_client import QdrantClient, models

BASE = Path(os.environ.get("BIBLIOTECA_DIR", "/srv/biblioteca"))
RAW = BASE / "raw"
LICENCAS_OK = ("acesso-aberto-governo", "creative-commons-", "licenciado-", "institucional")
COL, DIM = "biblioteca", 1024
MAX_PALAVRAS, OVERLAP = 380, 60
MIN_PALAVRAS = 25

QDRANT = os.environ.get("QDRANT_URL", "http://localhost:6333")
OLLAMA = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODELO = os.environ.get("EMBED_MODEL", "bge-m3")
qd = QdrantClient(url=QDRANT, timeout=120)


def embed(textos: list[str]) -> list[list[float]]:
    r = httpx.post(f"{OLLAMA}/api/embed", json={"model": MODELO, "input": textos}, timeout=900)
    r.raise_for_status()
    return r.json()["embeddings"]


def garantir_colecao():
    if not qd.collection_exists(COL):
        qd.create_collection(COL, vectors_config=models.VectorParams(size=DIM, distance=models.Distance.COSINE))
        qd.create_payload_index(COL, "tenant_id", models.PayloadSchemaType.KEYWORD)
        qd.create_payload_index(COL, "fonte_id", models.PayloadSchemaType.KEYWORD)
        qd.create_payload_index(COL, "texto", models.TextIndexParams(
            type="text", tokenizer=models.TokenizerType.WORD, lowercase=True, min_token_len=2, max_token_len=30))


def chunks_da_pagina(md: str):
    """(seção, bloco) por cabeçalho markdown. Linhas de tabela viram texto corrido."""
    secao, buf = "", []
    for linha in md.splitlines():
        if re.match(r"^#{1,4}\s", linha):
            if buf:
                yield secao, " ".join(buf)
                buf = []
            secao = linha.lstrip("# ").strip()
        elif linha.strip() and not re.match(r"^\|?\s*[-:]{3,}", linha):
            buf.append(re.sub(r"\s*\|\s*", " | ", linha.strip()).strip("| "))
    if buf:
        yield secao, " ".join(buf)


def janelas(texto: str):
    p = texto.split()
    passo = MAX_PALAVRAS - OVERLAP
    for i in range(0, max(len(p), 1), passo):
        yield " ".join(p[i:i + MAX_PALAVRAS])
        if i + MAX_PALAVRAS >= len(p):
            break


def fonte_id_de(nome: str) -> str:
    return hashlib.sha1(nome.encode()).hexdigest()[:12]


def apagar_fonte(fonte_id: str):
    qd.delete(COL, points_selector=models.FilterSelector(filter=models.Filter(
        must=[models.FieldCondition(key="fonte_id", match=models.MatchValue(value=fonte_id))])))


def chunks_pdf(caminho: Path):
    import pymupdf4llm
    paginas = pymupdf4llm.to_markdown(str(caminho), page_chunks=True, show_progress=False)
    for pg in paginas:
        n_pag = pg["metadata"]["page"]
        for secao, bloco in chunks_da_pagina(pg["text"]):
            for trecho in janelas(bloco):
                if len(trecho.split()) >= MIN_PALAVRAS:
                    yield {"texto": trecho, "secao": secao, "pagina": n_pag}


def chunks_md(caminho: Path, ref: str):
    md = caminho.read_text(encoding="utf-8")
    md = re.sub(r"^---\r?\n.*?\r?\n---\r?\n", "", md, count=1, flags=re.S)
    secao_atual = ""
    for secao, bloco in chunks_da_pagina(md):
        secao_atual = secao or secao_atual
        for trecho in janelas(bloco):
            if len(trecho.split()) >= 12:
                yield {"texto": trecho, "secao": secao_atual, "pagina": None, "ref": ref}


def gravar(fonte: dict, fonte_id: str, lote: list[dict]) -> int:
    total = 0
    # lotes pequenos: a API consulta o mesmo Ollama e não pode esperar um lote grande
    for i in range(0, len(lote), 8):
        parte = lote[i:i + 8]
        vetores = embed([c["texto"] for c in parte])
        qd.upsert(COL, points=[models.PointStruct(
            id=int(hashlib.sha1(f"{fonte_id}-{i + j}".encode()).hexdigest()[:15], 16),
            vector=v,
            payload={**c, "fonte_id": fonte_id, "titulo": fonte["titulo"], "editor": fonte["editor"],
                     "ano": fonte["ano"], "licenca": fonte["licenca"], "url": fonte.get("url"),
                     "tenant_id": str(fonte.get("tenant_id", "global"))},
        ) for j, (c, v) in enumerate(zip(parte, vetores))])
        total += len(parte)
    return total


def validar(fonte: dict):
    lic = str(fonte.get("licenca", ""))
    alvo = fonte.get("arquivo") or fonte.get("pasta")
    if not lic.startswith(LICENCAS_OK):
        sys.exit(f"BLOQUEADO (R4): {alvo} sem licença válida em fontes.yaml (tem: {lic!r})")
    for k in ("titulo", "editor", "ano"):
        if k not in fonte:
            sys.exit(f"BLOQUEADO: fonte {alvo} sem campo '{k}'")


def ingerir_pdf(fonte: dict):
    validar(fonte)
    caminho = RAW / fonte["arquivo"]
    if not caminho.exists():
        print(f"AVISO: {caminho} não existe; pulando", file=sys.stderr)
        return
    fid = fonte_id_de(fonte["arquivo"])
    apagar_fonte(fid)
    lote = list(chunks_pdf(caminho))
    n = gravar(fonte, fid, lote)
    print(f"{fonte['arquivo']}: {n} chunks", flush=True)


def cabecalho_md(md: str) -> dict:
    """Front matter simples (--- chave: valor ---) do corpus da Central."""
    m = re.match(r"^---\r?\n(.*?)\r?\n---", md, re.S)
    return yaml.safe_load(m.group(1)) or {} if m else {}


def ingerir_pasta_md(fonte: dict):
    validar(fonte)
    pasta = BASE / fonte["pasta"]
    arquivos = sorted(pasta.glob("*.md"))
    if not arquivos:
        print(f"AVISO: nenhum .md em {pasta}", file=sys.stderr)
        return
    total = 0
    for arq in arquivos:
        meta = cabecalho_md(arq.read_text(encoding="utf-8"))
        f = {**fonte,
             "titulo": f"{fonte['titulo']} — {meta.get('titulo') or arq.stem}",
             "url": meta.get("rota") or fonte.get("url")}
        ref = str(meta.get("fontes") or "")
        fid = fonte_id_de(f"{fonte['pasta']}/{arq.name}")
        apagar_fonte(fid)
        total += gravar(f, fid, list(chunks_md(arq, ref)))
    print(f"{fonte['pasta']}: {len(arquivos)} arquivos, {total} chunks", flush=True)


if __name__ == "__main__":
    garantir_colecao()
    fontes = yaml.safe_load(open(BASE / "fontes.yaml", encoding="utf-8")) or []
    so = [s.rstrip("/") for s in sys.argv[1:]]
    for f in fontes:
        alvo = f.get("arquivo") or f.get("pasta")
        if so and alvo not in so:
            continue
        if f.get("pasta"):
            ingerir_pasta_md(f)
        else:
            ingerir_pdf(f)
    print("pontos na coleção:", qd.get_collection(COL).points_count)
