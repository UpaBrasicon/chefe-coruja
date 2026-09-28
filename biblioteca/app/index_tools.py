"""Indexa ferramentas.json (exportado do registry por scripts/ferramentas-json.mjs)
na coleção `ferramentas` para a busca semântica de calculadoras."""
import json
import os
from pathlib import Path

import httpx
from qdrant_client import QdrantClient, models

BASE = Path(os.environ.get("BIBLIOTECA_DIR", "/srv/biblioteca"))
QDRANT = os.environ.get("QDRANT_URL", "http://localhost:6333")
OLLAMA = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODELO = os.environ.get("EMBED_MODEL", "bge-m3")

qd = QdrantClient(url=QDRANT, timeout=120)
tools = json.load(open(BASE / "ferramentas.json", encoding="utf-8"))
textos = [f"{t['nome']}. {t['categoria']}. {t['descricao']} {' '.join(t.get('sinonimos', []))}" for t in tools]
vetores: list[list[float]] = []
for i in range(0, len(textos), 32):
    r = httpx.post(f"{OLLAMA}/api/embed", json={"model": MODELO, "input": textos[i:i + 32]}, timeout=900)
    r.raise_for_status()
    vetores += r.json()["embeddings"]
if qd.collection_exists("ferramentas"):
    qd.delete_collection("ferramentas")
qd.create_collection("ferramentas", vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE))
qd.upsert("ferramentas", points=[models.PointStruct(id=i, vector=v, payload=t) for i, (t, v) in enumerate(zip(tools, vetores))])
print(len(tools), "ferramentas indexadas")
