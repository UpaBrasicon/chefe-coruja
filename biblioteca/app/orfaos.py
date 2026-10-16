"""Trechos órfãos na coleção: fonte_id que não está mais em fontes.yaml nem
nas pastas (ficha renomeada ou apagada do corpus). O órfão não tem público
conhecido e a busca o trata como adulto: uma ficha só pediátrica antiga
aparece em pergunta de adulto (achado da avaliação de 14/10/2026, Kawasaki).

Uso (dentro do container da API):
  python orfaos.py              # lista (só leitura)
  python orfaos.py --apagar     # apaga os órfãos da coleção BIBLIOTECA_COLECAO
"""
import os
import sys
from collections import Counter
from pathlib import Path

from qdrant_client import QdrantClient, models

from publico import mapa_de_fontes

COL = os.environ.get("BIBLIOTECA_COLECAO", "biblioteca")
BASE = Path(os.environ.get("BIBLIOTECA_DIR", "/srv/biblioteca"))
qd = QdrantClient(url=os.environ["QDRANT_URL"], timeout=120)


def prefixos_registrados() -> tuple[str, ...]:
    """Títulos das fontes de fontes.yaml. Trecho de fonte que não está aqui
    (pasta ingerida e nunca registrada) NÃO é órfão: em 16/10/2026 os artigos
    abertos e as fichas de referência apareceram como órfãos só por isso."""
    import yaml
    fontes = yaml.safe_load(open(BASE / "fontes.yaml", encoding="utf-8")) or []
    return tuple(f"{f['titulo']} — " if f.get("pasta") else f["titulo"] for f in fontes if f.get("titulo"))


def orfaos() -> tuple[Counter, dict]:
    conhecidos = set(mapa_de_fontes(BASE))
    if not conhecidos:
        sys.exit("fontes.yaml não lido: nada a comparar")
    prefixos = prefixos_registrados()
    contagem, titulo = Counter(), {}
    proximo = None
    while True:
        pontos, proximo = qd.scroll(COL, limit=1000, offset=proximo, with_payload=["fonte_id", "titulo"], with_vectors=False)
        for p in pontos:
            fid = p.payload.get("fonte_id")
            # só é órfão o trecho de fonte registrada cujo arquivo saiu da pasta
            if fid not in conhecidos and str(p.payload.get("titulo") or "").startswith(prefixos):
                contagem[fid] += 1
                titulo.setdefault(fid, p.payload.get("titulo"))
        if proximo is None:
            break
    return contagem, titulo


if __name__ == "__main__":
    contagem, titulo = orfaos()
    print(f"coleção {COL}: {sum(contagem.values())} trechos órfãos em {len(contagem)} fontes")
    for fid, n in contagem.most_common():
        print(f"  {fid}  {n:4d}  {titulo[fid]}")
    if "--apagar" in sys.argv and contagem:
        qd.delete(COL, points_selector=models.FilterSelector(filter=models.Filter(
            must=[models.FieldCondition(key="fonte_id", match=models.MatchAny(any=list(contagem)))])), wait=True)
        print("apagados; pontos na coleção:", qd.get_collection(COL).points_count)
