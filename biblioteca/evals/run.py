"""Roda as evals de perguntas.yaml contra /v1/ask e compara com as metas do guia.

Uso (no VPS):  docker compose run --rm api python /srv/biblioteca/evals/run.py
Métricas e metas: fonte esperada citada ≥ 85 %; ferramenta esperada ≥ 90 %;
fora do escopo bloqueado = 100 %; respostas sem citação = 0 %; p50 do 1º token ≤ 3 s.
"""
import json
import os
import statistics
import sys
import time
from datetime import date
from pathlib import Path

import httpx
import yaml

BASE = Path(os.environ.get("BIBLIOTECA_DIR", "/srv/biblioteca"))
URL = os.environ.get("BIBLIOTECA_URL", "http://api:8710" if os.path.exists("/.dockerenv") else "http://localhost:8710")
KEY = os.environ.get("BIBLIOTECA_API_KEY")
if not KEY:
    for linha in (BASE / "app/.env").read_text().splitlines():
        if linha.startswith("BIBLIOTECA_API_KEY="):
            KEY = linha.split("=", 1)[1].strip()
itens = yaml.safe_load(open(BASE / "evals/perguntas.yaml", encoding="utf-8"))

resultados = []
for i, it in enumerate(itens):
    t0 = time.time()
    r = {"q": it["q"], "gate": None, "fontes": [], "ferramentas": [], "sem_citacao": None, "invalidas": [], "t1": None, "texto": ""}
    try:
        with httpx.stream("POST", f"{URL}/v1/ask", headers={"Authorization": f"Bearer {KEY}"},
                          json={"q": it["q"], "tenant_id": "global", "request_id": f"eval-{i}"}, timeout=120) as resp:
            for linha in resp.iter_lines():
                if not linha.strip():
                    continue
                ev = json.loads(linha)
                if ev["type"] == "meta":
                    r["gate"] = ev["gate"]
                    r["fontes"] = [f["titulo"] for f in ev["fontes"]]
                    r["ferramentas"] = [f["id"] for f in ev["ferramentas"]]
                    r["melhor"] = ev.get("melhor_score")
                elif ev["type"] == "delta":
                    if r["t1"] is None:
                        r["t1"] = time.time() - t0
                    r["texto"] += ev["text"]
                elif ev["type"] == "done":
                    r["sem_citacao"] = ev.get("sem_citacao")
                    r["invalidas"] = ev.get("citacoes_invalidas", [])
                elif ev["type"] == "error":
                    r["erro"] = ev["text"]
    except Exception as e:
        r["erro"] = repr(e)
    r["ms"] = int((time.time() - t0) * 1000)
    # avaliação
    r["ok_fonte"] = (any(it["espera_fonte_contendo"].lower() in f.lower() for f in r["fontes"])
                     if "espera_fonte_contendo" in it else None)
    r["ok_ferramenta"] = (it["espera_ferramenta"] in r["ferramentas"]) if "espera_ferramenta" in it else None
    r["ok_gate"] = (r["gate"] == it["espera_gate"]) if "espera_gate" in it else None
    resultados.append(r)
    marca = "✓" if all(x is not False for x in (r["ok_fonte"], r["ok_ferramenta"], r["ok_gate"])) else "✗"
    print(f"{marca} {it['q'][:60]:60} gate={r['gate']} top={r.get('melhor')} fontes={r['fontes'][:2]} tools={r['ferramentas'][:3]} t1={r['t1'] and round(r['t1'], 2)}", flush=True)


def taxa(chave):
    v = [r[chave] for r in resultados if r[chave] is not None]
    return (sum(v) / len(v) if v else None), len(v)

f, nf = taxa("ok_fonte")
t, nt = taxa("ok_ferramenta")
g, ng = taxa("ok_gate")
sem = [r for r in resultados if r["gate"] and r["sem_citacao"]]
inval = [r for r in resultados if r["invalidas"]]
t1 = [r["t1"] for r in resultados if r["t1"] and r["gate"]]
p50 = statistics.median(t1) if t1 else None
resumo = {
    "data": str(date.today()), "n": len(resultados),
    "fonte_esperada_citada": f, "n_fonte": nf, "meta_fonte": 0.85,
    "ferramenta_esperada": t, "n_ferramenta": nt, "meta_ferramenta": 0.90,
    "fora_escopo_bloqueado": g, "n_gate": ng, "meta_gate": 1.0,
    "sem_citacao": len(sem), "citacoes_invalidas": len(inval),
    "p50_primeiro_token_s": p50, "meta_p50_s": 3.0,
}
print("\nRESUMO:", json.dumps(resumo, ensure_ascii=False, indent=1))
aprovado = ((f is None or f >= 0.85) and (t is None or t >= 0.90) and (g is None or g >= 1.0)
            and not sem and (p50 is None or p50 <= 3.0))
print("APROVADO" if aprovado else "REPROVADO")
saida = BASE / "evals" / f"resultado-{date.today()}.json"
try:
    saida.write_text(json.dumps({"resumo": resumo, "itens": resultados}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("gravado em", saida)
except OSError:
    print(json.dumps({"resumo": resumo, "itens": resultados}, ensure_ascii=False))
sys.exit(0 if aprovado else 1)
