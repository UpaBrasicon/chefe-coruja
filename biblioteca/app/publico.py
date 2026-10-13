"""Público da pergunta e das fontes (R2-13, decisão do RT em 13/10/2026).

Regra do projeto: dose de adulto não vai para criança. A biblioteca não pode
depender só do comando ao modelo (o teste da Rodada 2 mostrou o modelo usando
a ficha de adulto para uma criança de 9 anos). Por isso a própria busca filtra:

* pergunta de criança  → só trechos de fonte pediátrica ou geral ("ambos");
  sem nenhum, a resposta é "Não há referência pediátrica no material".
* pergunta de adulto   → tudo, menos as fontes só pediátricas.

Pediatria vai de 1 dia de vida a 13 anos, 11 meses e 29 dias (CLAUDE.md).
"""
import hashlib
import re
import threading
import time
import unicodedata
from pathlib import Path

import yaml

PED, ADULTO, AMBOS = "pediatrico", "adulto", "ambos"

MSG_SEM_PEDIATRIA = "Não há referência pediátrica no material para esta pergunta."

_PALAVRAS_PED = re.compile(
    r"\b(crianca|criancas|pediatri\w*|rn|rns|recem[- ]?nascid\w*|neonat\w*|lactente\w*|bebe|bebes|"
    r"menin[oa]s?|infantil|escolar|pre[- ]?escolar|adolescente\w*|puerici\w*)\b")
# idade em dias/semanas/meses de vida ("RN de 10 dias", "lactente de 8 meses", "3 meses de idade")
_IDADE_CURTA = re.compile(
    r"\b(?:de|com)\s+\d{1,3}\s*(?:dias?|semanas?|meses|mes)\b(?!\s+de\s+(?:evolucao|historia|febre|tosse|sintoma))"
    r"|\b\d{1,3}\s*(?:dias?|semanas?|meses|mes)\s+de\s+(?:vida|idade)\b")
# idade em anos de quem é atendido; "há 10 anos" (tempo decorrido) não conta
_IDADE_ANOS = re.compile(r"(?<!ha )(?<!desde )\b(\d{1,3})\s*anos?\b(?!\s+(?:atras|antes))")


def _plano(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def publico_da_pergunta(q: str, modo: str | None = None) -> str:
    """'pediatrico' ou 'adulto'. O modo pediátrico da tela vale sempre; o texto
    da pergunta também leva a pediatria quando fala de criança (o mais seguro)."""
    if modo == PED:
        return PED
    t = _plano(q)
    idades = [int(n) for n in _IDADE_ANOS.findall(t)]
    if idades:
        # idade declarada decide: menos de 14 anos é pediatria
        if min(idades) < 14:
            return PED
        if not re.search(r"\b(rn|recem[- ]?nascid\w*|neonat\w*|lactente\w*)\b", t):
            return ADULTO
    if _IDADE_CURTA.search(t) or _PALAVRAS_PED.search(t):
        return PED
    return ADULTO


def publico_do_texto(valor: object, padrao: str = ADULTO) -> str:
    """Normaliza o campo `publico` de fontes.yaml ou do cabeçalho da ficha."""
    v = _plano(str(valor or ""))
    if not v:
        return padrao
    tem_ped = "pediatr" in v or "crianca" in v
    tem_adulto = "adulto" in v
    if tem_ped and tem_adulto or "ambos" in v:
        return AMBOS
    if tem_ped:
        return PED
    if tem_adulto:
        return ADULTO
    return padrao


def publico_da_ferramenta(tool: dict) -> str:
    """Ferramentas da Central: o campo `publico` vem de ferramentas.json
    (src/content/publicoFerramentas.ts). Sem ele, a rota e o nome decidem."""
    p = tool.get("publico")
    if p in (PED, ADULTO, AMBOS):
        return p
    if p == "sem_idade":
        return AMBOS
    rota = str(tool.get("rota") or "")
    nome = _plano(str(tool.get("nome") or ""))
    if "/pediatria/" in rota or "/infusoes-pediatria/" in rota or re.search(r"\b(crianca|pediatr\w*|neonat\w*)\b", nome):
        return PED
    return ADULTO


def ferramenta_serve(tool: dict, publico: str) -> bool:
    p = publico_da_ferramenta(tool)
    return p != ADULTO if publico == PED else p != PED


def _fonte_id(nome: str) -> str:
    # o mesmo de ingest.fonte_id_de
    return hashlib.sha1(nome.encode()).hexdigest()[:12]


def _cabecalho(md: str) -> dict:
    m = re.match(r"^---\r?\n(.*?)\r?\n---", md, re.S)
    try:
        return (yaml.safe_load(m.group(1)) or {}) if m else {}
    except yaml.YAMLError:
        return {}


def mapa_de_fontes(base: Path) -> dict[str, str]:
    """fonte_id → público, a partir de fontes.yaml (campo `publico`) e do
    cabeçalho de cada ficha das pastas. O que não estiver aqui é adulto."""
    try:
        fontes = yaml.safe_load(open(base / "fontes.yaml", encoding="utf-8")) or []
    except OSError:
        return {}
    mapa: dict[str, str] = {}
    for f in fontes:
        padrao = publico_do_texto(f.get("publico"), ADULTO)
        if f.get("arquivo"):
            mapa[_fonte_id(f["arquivo"])] = padrao
        elif f.get("pasta"):
            pasta = base / f["pasta"]
            for arq in sorted(pasta.glob("*.md")):
                try:
                    meta = _cabecalho(arq.read_text(encoding="utf-8"))
                except OSError:
                    meta = {}
                mapa[_fonte_id(f"{f['pasta']}/{arq.name}")] = publico_do_texto(meta.get("publico"), padrao)
    return mapa


class Fontes:
    """Mapa fonte_id → público, relido de tempos em tempos (a ingestão roda em
    outro container e pode trocar fontes.yaml e as fichas)."""

    def __init__(self, base: Path, ttl_s: int = 600):
        self.base, self.ttl = base, ttl_s
        self._mapa: dict[str, str] = {}
        self._quando = 0.0
        self._trava = threading.Lock()

    def mapa(self) -> dict[str, str]:
        with self._trava:
            if time.time() - self._quando > self.ttl:
                self._mapa = mapa_de_fontes(self.base)
                self._quando = time.time()
            return self._mapa

    def ids(self, publicos: set[str]) -> list[str]:
        return sorted(fid for fid, p in self.mapa().items() if p in publicos)
