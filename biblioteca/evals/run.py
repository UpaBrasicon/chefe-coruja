"""Roda as evals contra /v1/ask e compara com as metas do guia (§11).

Uso (no VPS):  docker compose run --rm api python -u /srv/biblioteca/evals/run.py
Outro arquivo: EVALS_ARQUIVO=/srv/biblioteca/evals/perguntas-falhas.yaml (caça a falhas)

Campos por item:
  q                      pergunta
  espera_fonte_contendo  trecho do título de uma fonte que precisa estar entre as citadas
  espera_ferramenta      id (slug) de ferramenta da Central que precisa vir sugerida
  espera_gate            false = fora do escopo, precisa bloquear (true = precisa passar)
  deve_conter            lista de textos que a resposta precisa conter (sem acento/caixa)
  nao_deve_conter        lista de textos que a resposta NÃO pode conter (ex.: dose calculada, CPF)
  tenant                 tenant_id a usar (padrão global)

Metas: fonte esperada citada ≥ 85 %; ferramenta esperada ≥ 90 %; fora do escopo
bloqueado = 100 %; respostas sem citação = 0 %; p50 do 1º token ≤ 3 s.
"""
import json
import os
import statistics
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

import httpx
import yaml

BASE = Path(os.environ.get("BIBLIOTECA_DIR", "/srv/biblioteca"))
URL = os.environ.get("BIBLIOTECA_URL", "http://api:8710" if os.path.exists("/.dockerenv") else "http://localhost:8710")
ARQ = Path(os.environ.get("EVALS_ARQUIVO", str(BASE / "evals/perguntas.yaml")))
KEY = os.environ.get("BIBLIOTECA_API_KEY")
if not KEY:
    for linha in (BASE / "app/.env").read_text().splitlines():
        if linha.startswith("BIBLIOTECA_API_KEY="):
            KEY = linha.split("=", 1)[1].strip()
itens = yaml.safe_load(open(ARQ, encoding="utf-8"))


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


resultados = []
for i, it in enumerate(itens):
    t0 = time.time()
    r = {"q": it["q"], "gate": None, "fontes": [], "ferramentas": [], "sem_citacao": None, "invalidas": [], "t1": None,
         "texto": "", "erro": None, "melhor": None}
    try:
        with httpx.stream("POST", f"{URL}/v1/ask", headers={"Authorization": f"Bearer {KEY}"},
                          json={"q": it["q"], "tenant_id": it.get("tenant", "global"), "request_id": f"eval-{i}"}, timeout=180) as resp:
            if resp.status_code != 200:
                r["erro"] = f"http {resp.status_code}"
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
    txt = norm(r["texto"])
    # avaliação
    r["ok_fonte"] = (any(norm(it["espera_fonte_contendo"]) in norm(f) for f in r["fontes"])
                     if "espera_fonte_contendo" in it else None)
    r["ok_ferramenta"] = (it["espera_ferramenta"] in r["ferramentas"]) if "espera_ferramenta" in it else None
    r["ok_gate"] = (r["gate"] == it["espera_gate"]) if "espera_gate" in it else None
    r["ok_contem"] = (all(norm(x) in txt for x in it["deve_conter"])) if it.get("deve_conter") else None
    r["ok_nao_contem"] = (not any(norm(x) in txt for x in it["nao_deve_conter"])) if it.get("nao_deve_conter") else None
    r["vazia"] = bool(r["gate"]) and not r["texto"].strip() and not r["erro"]
    resultados.append(r)
    checks = (r["ok_fonte"], r["ok_ferramenta"], r["ok_gate"], r["ok_contem"], r["ok_nao_contem"])
    marca = "✗" if any(x is False for x in checks) or r["erro"] or r["vazia"] else "✓"
    print(f"{marca} {it['q'][:58]:58} gate={r['gate']} top={r['melhor']} fontes={[f[:28] for f in r['fontes'][:2]]} "
          f"tools={r['ferramentas'][:3]} t1={r['t1'] and round(r['t1'], 2)}"
          f"{' ERRO=' + str(r['erro']) if r['erro'] else ''}{' VAZIA' if r['vazia'] else ''}"
          f"{' SEM_CITACAO' if r['gate'] and r['sem_citacao'] else ''}", flush=True)


def taxa(chave):
    v = [r[chave] for r in resultados if r[chave] is not None]
    return (sum(v) / len(v) if v else None), len(v)


f, nf = taxa("ok_fonte")
t, nt = taxa("ok_ferramenta")
g, ng = taxa("ok_gate")
c, nc = taxa("ok_contem")
nc_ok, nnc = taxa("ok_nao_contem")
sem = [r for r in resultados if r["gate"] and r["sem_citacao"]]
inval = [r for r in resultados if r["invalidas"]]
vazias = [r for r in resultados if r["vazia"]]
erros = [r for r in resultados if r["erro"]]
t1 = [r["t1"] for r in resultados if r["t1"] and r["gate"]]
p50 = statistics.median(t1) if t1 else None
resumo = {
    "data": str(date.today()), "arquivo": ARQ.name, "n": len(resultados),
    "fonte_esperada_citada": f, "n_fonte": nf, "meta_fonte": 0.85,
    "ferramenta_esperada": t, "n_ferramenta": nt, "meta_ferramenta": 0.90,
    "gate_como_esperado": g, "n_gate": ng, "meta_gate": 1.0,
    "deve_conter_ok": c, "n_deve_conter": nc,
    "nao_deve_conter_ok": nc_ok, "n_nao_deve_conter": nnc,
    "sem_citacao": len(sem), "citacoes_invalidas": len(inval), "respostas_vazias": len(vazias), "erros": len(erros),
    "p50_primeiro_token_s": p50, "p90_primeiro_token_s": (sorted(t1)[int(len(t1) * 0.9)] if t1 else None), "meta_p50_s": 3.0,
}
print("\nRESUMO:", json.dumps(resumo, ensure_ascii=False, indent=1))
aprovado = ((f is None or f >= 0.85) and (t is None or t >= 0.90) and (g is None or g >= 1.0)
            and (c is None or c >= 1.0) and (nc_ok is None or nc_ok >= 1.0)
            and not sem and not vazias and not erros and (p50 is None or p50 <= 3.0))
print("APROVADO" if aprovado else "REPROVADO")
falhas = [r for r in resultados if any(r[k] is False for k in ("ok_fonte", "ok_ferramenta", "ok_gate", "ok_contem", "ok_nao_contem")) or r["erro"] or r["vazia"] or (r["gate"] and r["sem_citacao"])]
print(f"\nFALHAS ({len(falhas)}):")
for r in falhas:
    motivos = [k for k in ("ok_fonte", "ok_ferramenta", "ok_gate", "ok_contem", "ok_nao_contem") if r[k] is False]
    if r["erro"]: motivos.append("erro")
    if r["vazia"]: motivos.append("vazia")
    if r["gate"] and r["sem_citacao"]: motivos.append("sem_citacao")
    print(f"- {r['q'][:70]} | {', '.join(motivos)} | top={r['melhor']} | fontes={[x[:30] for x in r['fontes'][:2]]}")
saida = BASE / "evals" / f"resultado-{ARQ.stem}-{date.today()}.json"
try:
    saida.write_text(json.dumps({"resumo": resumo, "itens": resultados}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("gravado em", saida)
except OSError:
    print("JSON:", json.dumps({"resumo": resumo, "itens": resultados}, ensure_ascii=False))
sys.exit(0 if aprovado else 1)
