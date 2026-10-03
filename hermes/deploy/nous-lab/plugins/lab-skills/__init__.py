"""Organizador de skills da Coruja Lab (RT, 03/10/2026).

Faz o papel da SkillRet (ThakiCloud/SKILLRET: recuperar, para um pedido em
linguagem natural, as skills mais relevantes de uma biblioteca grande). Os
modelos treinados da SkillRet precisam de PyTorch/GPU, que o contêiner do Nous
não tem; aqui a recuperação é BM25 sobre nome, descrição e categoria de cada
SKILL.md, só com a biblioteca padrão do Python. A interface é a mesma: pedido
entra, as k skills mais próximas saem — o agente abre só essas, em vez de
varrer todas.
"""

from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path

TOOLSET = "lab-skills"

CATEGORIAS = [
    ("planejamento", re.compile(r"planning|plan")),
    ("delegacao", re.compile(r"delegate")),
    ("desenvolvimento-rtk", re.compile(r"^rtk-")),
    ("compressao-e-revisao", re.compile(r"cave|review|refactor|patch|investigate|verify|lean|migration")),
]


def _pasta_skills() -> Path:
    return Path(os.environ.get("HERMES_HOME", "/opt/data")) / "skills" / "terceiros"


def _frontmatter(texto: str) -> dict:
    m = re.match(r"^---\s*\n(.*?)\n---", texto, re.S)
    if not m:
        return {}
    dados: dict[str, str] = {}
    chave = None
    for linha in m.group(1).splitlines():
        r = re.match(r"^([A-Za-z_]+):\s*(.*)$", linha)
        if r:
            chave, valor = r.group(1), r.group(2).strip()
            dados[chave] = "" if valor in (">", ">-", "|", "|-") else valor.strip("\"'")
        elif chave and linha.startswith((" ", "\t")):
            dados[chave] = (dados.get(chave, "") + " " + linha.strip()).strip()
    return dados


def categoria(pasta: str) -> str:
    for cat, rx in CATEGORIAS:
        if rx.search(pasta):
            return cat
    return "outras"


def carregar(pasta: Path | None = None) -> list[dict]:
    pasta = pasta or _pasta_skills()
    skills = []
    for arq in sorted(pasta.glob("*/SKILL.md")):
        fm = _frontmatter(arq.read_text(encoding="utf-8", errors="replace"))
        skills.append({
            "nome": fm.get("name") or arq.parent.name,
            "pasta": arq.parent.name,
            "categoria": categoria(arq.parent.name),
            "descricao": (fm.get("description") or "")[:400],
        })
    return skills


_TOKEN = re.compile(r"[a-z0-9]+")


def _tokens(t: str) -> list[str]:
    return _TOKEN.findall(t.lower().replace("-", " "))


def buscar(pedido: str, skills: list[dict], k: int = 5) -> list[dict]:
    """BM25 (k1=1.5, b=0.75) sobre nome (peso 2) + categoria + descrição."""
    docs = [_tokens(f"{s['nome']} {s['nome']} {s['categoria']} {s['descricao']}") for s in skills]
    if not docs:
        return []
    n = len(docs)
    media = sum(map(len, docs)) / n
    df: dict[str, int] = {}
    for d in docs:
        for t in set(d):
            df[t] = df.get(t, 0) + 1
    consulta = _tokens(pedido)
    notas = []
    for s, d in zip(skills, docs):
        nota = 0.0
        for t in consulta:
            f = d.count(t)
            if f:
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                nota += idf * f * 2.5 / (f + 1.5 * (1 - 0.75 + 0.75 * len(d) / media))
        if nota > 0:
            notas.append((nota, s))
    notas.sort(key=lambda x: -x[0])
    return [dict(s, relevancia=round(nota, 2)) for nota, s in notas[:k]]


BUSCAR_SCHEMA = {
    "name": "skill_buscar",
    "description": (
        "Encontra as skills instaladas mais relevantes para um pedido (organizador no papel da SkillRet). "
        "Use ANTES de abrir uma skill: devolve nome, pasta, categoria e descrição das melhores; depois "
        "carregue só a escolhida."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "pedido": {"type": "string", "description": "o que a pessoa quer fazer"},
            "k": {"type": "integer", "description": "quantas devolver (1-10, padrão 5)"},
        },
        "required": ["pedido"],
    },
}

CATEGORIAS_SCHEMA = {
    "name": "skill_categorias",
    "description": "Lista as skills instaladas agrupadas por categoria (planejamento, delegação, compressão e revisão, desenvolvimento rtk).",
    "parameters": {"type": "object", "properties": {}},
}


def _buscar(args: dict, **_kw) -> str:
    pedido = str(args.get("pedido") or "").strip()[:500]
    if len(pedido) < 3:
        return json.dumps({"ok": False, "erro": "descreva o pedido"}, ensure_ascii=False)
    try:
        k = max(1, min(10, int(args.get("k") or 5)))
    except (TypeError, ValueError):
        k = 5
    return json.dumps({"ok": True, "skills": buscar(pedido, carregar(), k)}, ensure_ascii=False)


def _categorias(_args: dict, **_kw) -> str:
    grupos: dict[str, list[str]] = {}
    for s in carregar():
        grupos.setdefault(s["categoria"], []).append(s["nome"])
    return json.dumps({"ok": True, "categorias": grupos}, ensure_ascii=False)


def register(ctx) -> None:
    # só no agente Lab: as Corujas de saúde não têm skills de terceiros
    if os.environ.get("CORUJA_AGENTE", "").strip().lower() != "lab":
        return
    ctx.register_tool(name="skill_buscar", toolset=TOOLSET, schema=BUSCAR_SCHEMA, handler=_buscar, emoji="🧭")
    ctx.register_tool(name="skill_categorias", toolset=TOOLSET, schema=CATEGORIAS_SCHEMA, handler=_categorias, emoji="🗂️")
