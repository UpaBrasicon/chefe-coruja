#!/usr/bin/env python3
"""Lint do LLM Wiki — SEM LLM (rodada C do Hermes, 27/09/2026).

O job semanal pedia ao modelo para "rodar o lint completo" e custava de 0,4 a
2,1 milhões de tokens por execução, para 8 páginas. As 7 verificações são
mecânicas; aqui viram código. Roda pelo cron do Hermes com `no_agent: true`
(como o wiki-backup) e o texto impresso é o relatório entregue no Telegram.

Contradição de dose entre páginas é leitura, não regra: fica sob demanda.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import re
import sys
from pathlib import Path

RAIZ = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/hermes-wiki")
HOJE = dt.date.today()
LIMITE_LINHAS = 200
OBRIGATORIOS = ("title", "created", "updated", "type", "tags", "orgao_emissor", "vigencia", "confidence")
OBRIGATORIOS_RAW = ("source_url", "orgao_emissor", "publicado", "ingested", "sha256", "licenca")
ORGAOS_REGULATORIOS = {"MS", "CFM", "CREMEGO"}


def frontmatter(texto: str) -> tuple[dict[str, str], str]:
    """Frontmatter YAML simples (chave: valor por linha) e o corpo."""
    if not texto.startswith("---"):
        return {}, texto
    fim = texto.find("\n---", 3)
    if fim < 0:
        return {}, texto
    campos: dict[str, str] = {}
    for linha in texto[3:fim].splitlines():
        m = re.match(r"^([a-z_]+):\s*(.*?)\s*$", linha)
        if m:
            campos[m.group(1)] = m.group(2).strip().strip("'\"")
    corpo = texto[fim + 4 :].lstrip("\n")
    return campos, corpo


def lista(valor: str) -> list[str]:
    return [x.strip().strip("'\"") for x in valor.strip("[]").split(",") if x.strip()]


def data(valor: str) -> dt.date | None:
    m = re.search(r"\d{4}-\d{2}-\d{2}", valor or "")
    return dt.date.fromisoformat(m.group(0)) if m else None


def taxonomia(schema: str) -> set[str]:
    trecho = schema.split("## Tag Taxonomy", 1)[-1].split("\n## ", 1)[0]
    return set(re.findall(r"`([a-z0-9-]+)`", trecho))


def main() -> int:
    if not RAIZ.exists():
        print(f"Lint do wiki: pasta {RAIZ} não encontrada.")
        return 0
    tags_validas = taxonomia((RAIZ / "SCHEMA.md").read_text(encoding="utf-8")) if (RAIZ / "SCHEMA.md").exists() else set()
    paginas = sorted(p for p in RAIZ.rglob("*.md") if "raw" not in p.relative_to(RAIZ).parts and p.name not in {"SCHEMA.md", "log.md"})
    fontes = sorted((RAIZ / "raw").rglob("*.md")) if (RAIZ / "raw").exists() else []

    achados: dict[int, list[str]] = {i: [] for i in range(1, 8)}
    textos = {p: p.read_text(encoding="utf-8", errors="replace") for p in paginas}
    slugs = {p.stem for p in paginas}
    citadas: set[str] = set()

    for p, t in textos.items():
        rel = p.relative_to(RAIZ).as_posix()
        # (1) links quebrados: [[slug]] e [texto](arquivo.md)
        for alvo in re.findall(r"\[\[([^\]|#]+)", t):
            citadas.add(alvo.strip())
            if alvo.strip() not in slugs:
                achados[1].append(f"{rel} → [[{alvo.strip()}]]")
        for alvo in re.findall(r"\]\(([^)#\s]+\.md)\)", t):
            destino = (p.parent / alvo).resolve()
            citadas.add(Path(alvo).stem)
            if not destino.exists():
                achados[1].append(f"{rel} → {alvo}")
        if p.name == "index.md":
            continue
        campos, corpo = frontmatter(t)
        # (4) contestadas
        if campos.get("contested", "").lower() == "true" or lista(campos.get("contradictions", "")):
            achados[4].append(f"{rel} (contradictions: {campos.get('contradictions', '—')})")
        # (5) vigência / idade da fonte
        vig = campos.get("vigencia", "")
        d = data(vig)
        if vig.startswith("revogada") or (d and d < HOJE and not vig.startswith("revogada")):
            achados[5].append(f"{rel}: vigência {vig}")
        # (6) frontmatter e taxonomia
        faltam = [c for c in OBRIGATORIOS if not campos.get(c)]
        if faltam:
            achados[6].append(f"{rel}: faltam {', '.join(faltam)}")
        fora = [x for x in lista(campos.get("tags", "")) if tags_validas and x not in tags_validas]
        if fora:
            achados[6].append(f"{rel}: tags fora da taxonomia: {', '.join(fora)}")
        # (7) tamanho
        n = t.count("\n") + 1
        if n > LIMITE_LINHAS:
            achados[7].append(f"{rel}: {n} linhas")

    # (2) órfãs: ninguém cita
    for p in paginas:
        if p.name != "index.md" and p.stem not in citadas:
            achados[2].append(p.relative_to(RAIZ).as_posix())

    # (3) drift de sha256 e idade das fontes em raw/
    for f in fontes:
        rel = f.relative_to(RAIZ).as_posix()
        campos, corpo = frontmatter(f.read_text(encoding="utf-8", errors="replace"))
        faltam = [c for c in OBRIGATORIOS_RAW if not campos.get(c)]
        if faltam:
            achados[6].append(f"{rel}: faltam {', '.join(faltam)}")
        esperado = campos.get("sha256", "")
        if esperado and hashlib.sha256(corpo.encode("utf-8")).hexdigest() != esperado:
            achados[3].append(rel)
        pub = data(campos.get("publicado", ""))
        if pub:
            anos = (HOJE - pub).days / 365.25
            limite = 2 if campos.get("orgao_emissor", "") in ORGAOS_REGULATORIOS else 5
            if anos > limite:
                achados[5].append(f"{rel}: publicada há {anos:.1f} anos (limite {limite})")

    titulos = {
        1: "Links quebrados",
        2: "Páginas órfãs (ninguém cita)",
        3: "Fonte em raw/ alterada (sha256 não confere)",
        4: "Páginas contestadas ou com contradição",
        5: "Vigência vencida ou fonte antiga",
        6: "Frontmatter incompleto ou tag fora da taxonomia",
        7: f"Páginas acima de {LIMITE_LINHAS} linhas",
    }
    total = sum(len(v) for v in achados.values())
    print(f"🦉 Lint do wiki — {HOJE.strftime('%d/%m/%Y')} · {len(paginas)} páginas · {len(fontes)} fontes · {total} apontamento(s)")
    if total == 0:
        print("Nada a apontar.")
    for i in range(1, 8):
        if achados[i]:
            print(f"\n({i}) {titulos[i]} — {len(achados[i])}")
            for linha in achados[i][:15]:
                print(f"  • {linha}")
            if len(achados[i]) > 15:
                print(f"  … e mais {len(achados[i]) - 15}")
    print("\nContradição de dose entre páginas é leitura clínica: sob demanda, não automática.")
    # registro no log.md do wiki
    log = RAIZ / "log.md"
    try:
        with log.open("a", encoding="utf-8") as fh:
            fh.write(f"\n- {HOJE.isoformat()} lint (script): {total} apontamento(s)\n")
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
