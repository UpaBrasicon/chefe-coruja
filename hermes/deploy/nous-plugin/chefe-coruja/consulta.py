"""Consultas da Corujinha direto no plugin — etapa 1 da migração Hermes → Nous.

Decisão do RT em 02/10/2026 (produto/docs/propostas/migracao-hermes-nous.md):
o plugin passa a chamar as RPCs ``hermes_*`` sem passar pelo hermes-app.

Este módulo é a tradução, com a MESMA semântica, de:
  • hermes/src/server/skill-api.ts  — /skill/consulta (incl. almanaque) e
    /skill/vincular: validação dos argumentos, guarda de papel, anti
    cross-tenant, textos de erro e formato da resposta (o modelo vê o mesmo
    JSON que via HTTP);
  • hermes/src/agent/identidade.ts  — resolverIdentidadePorCanal e a escolha
    do vínculo principal;
  • hermes/src/gateway/desidentificacao.ts — só ``desidentificar`` (usado nas
    notificações, ADR 0006).

Regras que não mudam com a mudança de casa:
  • quem pergunta vem SEMPRE da sessão do canal (o plugin passa canal +
    identificador lidos de get_session_env), nunca de argumento do modelo;
  • unidade_id vem do vínculo; pedir unidade fora dos vínculos = negado e
    registrado (hermes_audit_registrar);
  • segurança/infra exigem super_admin (vem da RPC, não de afirmação).

Acesso ao banco: SÓ pela função injetada ``rpc(nome, params)``. Este módulo
não importa driver. Contrato do ``rpc`` (o driver do db.py deve cumprir):
  • ``nome``: nome da função em ``public``; ``params``: dict de argumentos
    NOMEADOS (``p_perfil`` etc.), valores JSON (str, int, float, bool, None,
    list, dict). Chamada equivalente a ``public.nome(p_x => ..., ...)``.
  • retorno igual ao PostgREST / lib/pg.ts: ``setof``/RETURNS TABLE → list de
    dict (lista vazia quando não há linha); jsonb → dict/list ou None;
    escalar → valor Python (uuid como str, bigint/numeric como número,
    timestamp como str ISO); void → None.
  • erro de banco → LEVANTA exceção (qualquer Exception). Nunca devolver
    "vazio" no lugar de erro: erro vira "falha interna", vazio vira "não achei".
Python 3.11+, só biblioteca padrão.
"""

from __future__ import annotations

import logging
import math
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

log = logging.getLogger("chefe_coruja.consulta")

Rpc = Callable[[str, dict], Any]

# ── Allowlist: idêntica a RPC_USUARIO de hermes/src/lib/supabase.ts ──────────
RPC_USUARIO: frozenset[str] = frozenset({
    "hermes_identidade_por_telefone",
    "hermes_identidade_por_canal",
    "hermes_unidade_setores",
    "hermes_unidade_censo",
    "hermes_unidade_indicadores",
    "hermes_unidade_profissionais",
    "hermes_unidade_resumo",
    "hermes_unidade_internacoes_por_status",
    "hermes_unidade_nomes",
    "hermes_minhas_notificacoes",
    "hermes_alertas_escala",
    "hermes_relatorio_semanal_ultimo",
    "hermes_incidentes_abertos",
    "hermes_quarentena_pendente",
    "hermes_integridade_resumo",
    "hermes_liberar_quarentena",
    "hermes_sessao_carregar",
    "hermes_sessao_salvar",
    "hermes_audit_registrar",
    "hermes_quarentenar_conteudo",
    "hermes_plantoes_do_perfil",
    "hermes_plantao_do_dia",
    "hermes_almanaque_buscar",
    "confirmar_vinculo_hermes",
})


class RpcNaoPermitida(Exception):
    """Mesmo papel do erro HRM01 do shim de lib/pg.ts."""


def _chamar(rpc: Rpc, nome: str, params: dict) -> Any:
    """Toda chamada passa aqui: a allowlist é conferida antes do driver."""
    if nome not in RPC_USUARIO:
        raise RpcNaoPermitida(f"Função não permitida neste caminho: {nome[:64]}")
    return rpc(nome, params)


def _dados(valor: Any) -> Any:
    """``dados()`` do TS: erro já veio como exceção; ``null`` vira lista vazia."""
    return [] if valor is None else valor


def _verdadeiro_js(v: Any) -> bool:
    """Truthiness do JavaScript ({} e [] são verdadeiros; 0, '' e null não)."""
    if v is None or v is False:
        return False
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v != 0 and not (isinstance(v, float) and math.isnan(v))
    if isinstance(v, str):
        return v != ""
    return True


def _numero_js(v: Any) -> float:
    """``Number(v)`` do JavaScript, nos tipos que chegam por JSON."""
    if v is None:
        return 0
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        s = v.strip()
        if s == "":
            return 0
        try:
            if re.fullmatch(r"[+-]?0[xX][0-9a-fA-F]+", s):
                return int(s, 16)
            if s in ("Infinity", "+Infinity"):
                return math.inf
            if s == "-Infinity":
                return -math.inf
            if not re.fullmatch(r"[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?", s, re.ASCII):
                return math.nan
            return float(s)
        except ValueError:
            return math.nan
    if isinstance(v, list):
        if len(v) == 0:
            return 0
        if len(v) == 1:
            return _numero_js(v[0])
        return math.nan
    return math.nan


def _inteiro_se_exato(n: float) -> int | float:
    """JSON.stringify(7) dá ``7``; o Python daria ``7.0``. Mantém o inteiro."""
    if isinstance(n, float) and math.isfinite(n) and n.is_integer():
        return int(n)
    return n


def _hoje_brasilia(agora: datetime | None = None) -> str:
    """hojeBrasilia() de lib/tempo.ts: data civil de Brasília (AAAA-MM-DD)."""
    try:
        from zoneinfo import ZoneInfo

        fuso = ZoneInfo("America/Sao_Paulo")
    except Exception:  # noqa: BLE001 — sem tzdata: Brasília está em UTC-3 fixo desde 2019
        fuso = timezone(timedelta(hours=-3))
    momento = agora or datetime.now(timezone.utc)
    return momento.astimezone(fuso).strftime("%Y-%m-%d")


# ── Identidade (agent/identidade.ts) ─────────────────────────────────────────

PRECEDENCIA_PAPEL = {
    "admin": 8,
    "gestor": 7,
    "plantonista": 6,
    "enfermeiro": 5,
    "telemedicina": 4,
    "farmaceutico": 3,
    "tecnico_enfermagem": 2,
    "recepcao": 1,
}

CANAIS = ("telegram", "whatsapp")
_RE_IDENTIFICADOR = re.compile(r"[A-Za-z0-9_.:-]{1,64}")


def _peso(papel: Any) -> int:
    return PRECEDENCIA_PAPEL.get(papel, 0) if isinstance(papel, str) else 0


def montar_identidade(row: dict) -> dict:
    """Linha da RPC → identidade. Chaves como no TS (perfilId, superAdmin…)."""
    vinculos = [
        {
            "papel": v.get("papel"),
            "unidadeId": v.get("unidade_id"),
            "unidadeNome": v.get("unidade_nome"),
            "organizacaoId": v.get("organizacao_id"),
        }
        for v in (row.get("vinculos") or [])
    ]
    # Vínculo PRINCIPAL: maior precedência de papel, desempate determinístico
    # pelo unidade_id. Papel desconhecido pesa 0.
    ordenados = sorted(vinculos, key=lambda v: (-_peso(v["papel"]), str(v["unidadeId"] or "")))
    principal = ordenados[0] if ordenados else None
    return {
        "perfilId": row.get("perfil_id"),
        "nome": row.get("nome_completo"),
        "email": row.get("email"),
        "papel": principal["papel"] if principal else None,
        "unidadeId": principal["unidadeId"] if principal else None,
        "unidadeNome": principal["unidadeNome"] if principal else None,
        "organizacaoId": principal["organizacaoId"] if principal else None,
        "vinculos": vinculos,
        # `is True` proposital: ausência falha FECHADA (nunca concede).
        "superAdmin": row.get("is_super_admin") is True,
    }


def resolver_identidade_por_canal(rpc: Rpc, canal: str, identificador: str) -> dict | None:
    """Identidade pelo vínculo de canal. O identificador vem da SESSÃO."""
    if not isinstance(identificador, str) or not _RE_IDENTIFICADOR.fullmatch(identificador):
        return None
    try:
        linhas = _chamar(rpc, "hermes_identidade_por_canal", {"p_canal": canal, "p_identificador": identificador})
    except Exception as e:  # noqa: BLE001
        log.error("[identidade] falha ao consultar vínculo de canal: %s", e)
        raise RuntimeError("falha interna ao resolver identidade") from e
    # RETURNS TABLE → lista; a RPC só casa perfil ATIVO. Nada casado → 0 linhas.
    linhas = linhas or []
    if len(linhas) == 0:
        return None
    return montar_identidade(linhas[0])


# ── Guarda de papel e unidade (skill-api.ts) ─────────────────────────────────

RESPOSTA_GENERICA = (
    "Não encontrei informações sobre esse assunto. Se precisar de ajuda com escala ou plantões, é só perguntar."
)

ESCOPOS = ("aguia", "garca", "operacional", "escala", "sentinela", "seguranca", "infra")


def autorizado(escopo: str, ident: dict) -> bool:
    """Papel mínimo exigido por escopo — a regra de acesso."""
    su = ident.get("superAdmin") is True
    papel = ident.get("papel")
    if escopo in ("seguranca", "infra"):
        return su
    if escopo == "sentinela":
        return su or papel == "gestor" or papel == "admin"
    if escopo in ("aguia", "garca", "operacional", "escala"):
        # Qualquer usuário com vínculo ativo. O recorte dentro do escopo é do handler.
        return papel is not None or su
    return False


def papel_na_unidade(ident: dict, unidade_id: str) -> str | None:
    """Papel mais forte que a pessoa tem NAQUELA unidade."""
    ordem = ["admin", "gestor", "plantonista", "enfermeiro", "telemedicina", "farmaceutico", "tecnico_enfermagem", "recepcao"]
    papeis = [v.get("papel") for v in ident.get("vinculos", []) if v.get("unidadeId") == unidade_id]
    return next((p for p in ordem if p in papeis), None)


def resolver_unidade(ident: dict, pedida: str | None) -> dict:
    """Sobre QUAL unidade a consulta roda. O argumento só escolhe entre os vínculos."""
    if not pedida:
        return {"ok": True, "unidadeId": ident.get("unidadeId")}
    if ident.get("superAdmin") is True:
        return {"ok": True, "unidadeId": pedida}
    if not any(v.get("unidadeId") == pedida for v in ident.get("vinculos", [])):
        return {"ok": False}
    return {"ok": True, "unidadeId": pedida}


# ── Desidentificação (gateway/desidentificacao.ts, só o necessário) ──────────

_LETRA = r"[^\W\d_]"  # \p{L} aproximado: letra Unicode


def criar_cofre() -> dict:
    return {"paraOriginal": {}, "paraPseudonimo": {}, "contadores": {}}


def _normalizar(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[̀-ͯ]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def _pseudonimo(cofre: dict, categoria: str, original: str) -> str:
    chave = f"{categoria}:{_normalizar(original)}"
    existente = cofre["paraPseudonimo"].get(chave)
    if existente:
        return existente
    n = cofre["contadores"].get(categoria, 0) + 1
    cofre["contadores"][categoria] = n
    p = f"[{categoria}_{n}]"
    cofre["paraPseudonimo"][chave] = p
    cofre["paraOriginal"][p] = original
    return p


def _so_digitos(s: str) -> str:
    return "".join(c for c in s if c in "0123456789")


def cpf_valido(valor: str) -> bool:
    d = _so_digitos(valor)
    if len(d) != 11 or re.fullmatch(r"(\d)\1{10}", d):
        return False

    def dv(base: str, peso_inicial: int) -> int:
        soma = sum(int(base[i]) * (peso_inicial - i) for i in range(len(base)))
        r = (soma * 10) % 11
        return 0 if r == 10 else r

    return dv(d[:9], 10) == int(d[9]) and dv(d[:10], 11) == int(d[10])


def cns_valido(valor: str) -> bool:
    d = _so_digitos(valor)
    if len(d) != 15 or d[0] not in "12789":
        return False
    return sum(int(d[i]) * (15 - i) for i in range(15)) % 11 == 0


# \d e \w do JavaScript são ASCII; aqui escritos por extenso.
_RE_EMAIL = re.compile(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+")
_RE_CNS = re.compile(r"(?<![0-9])[0-9]{3}[ .]?[0-9]{4}[ .]?[0-9]{4}[ .]?[0-9]{4}(?![0-9])")
_RE_CPF = re.compile(r"(?<![0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?![0-9])")
_RE_PRONTUARIO = re.compile(r"(?<![0-9])(?:19|20)[0-9]{2}\.[0-9]{6}(?![0-9])")
_RE_DATA = re.compile(r"(?<![0-9])(?:0?[1-9]|[12][0-9]|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)[0-9]{2}(?![0-9])")
_RE_CEP = re.compile(r"(?<![0-9])[0-9]{5}-[0-9]{3}(?![0-9])")
_RE_TELEFONE = re.compile(r"(?<![A-Za-z0-9_])(?:\+?55\s?)?(?:\(?[0-9]{2}\)?\s?)?9?[0-9]{4}[-\s]?[0-9]{4}(?![0-9])")

_PARTICULA = "(?:da|de|do|das|dos|e)"
_PALAVRA_NOME = "[A-ZÀ-Ý][a-zà-ÿ]+"


def _sem_caixa(palavra: str) -> str:
    # Só o gatilho ignora maiúsculas; o nome precisa começar com maiúscula.
    return "".join(f"[{c.lower()}{c.upper()}]" if c.isalpha() else re.escape(c) for c in palavra)


_GATILHOS = [
    r"\s+".join(_sem_caixa(p) for p in g.split(" "))
    for g in [
        "paciente", "pcte", "pct", "pac.", "sr.", "sr", "sra.", "sra", "srta.", "dona", "seu", "mãe", "mae", "pai",
        "responsável", "responsavel", "acompanhante", "nome do paciente", "nome da paciente", "nome",
    ]
]
_RE_NOME_APOS_GATILHO = re.compile(
    rf"((?<!{_LETRA})(?:{'|'.join(_GATILHOS)})\s*:?\s+)"
    rf"({_PALAVRA_NOME}(?:\s+(?:{_PARTICULA}\s+)?{_PALAVRA_NOME}){{0,4}})"
)


def desidentificar(texto: str, cofre: dict, conhecidos: list[dict] | None = None) -> dict:
    """Troca identificadores por pseudônimos; ``conhecidos`` saem sempre."""
    contagem: dict[str, int] = {}

    def contar(c: str) -> None:
        contagem[c] = contagem.get(c, 0) + 1

    t = texto
    # 1. Valores conhecidos, do mais longo para o mais curto.
    ordenados = sorted(
        [k for k in (conhecidos or []) if k.get("valor") and len(k["valor"].strip()) >= 3],
        key=lambda k: -len(k["valor"]),
    )
    for k in ordenados:
        corpo = r"\s+".join(re.escape(p) for p in k["valor"].strip().split())
        re_k = re.compile(rf"(?<!{_LETRA}){corpo}(?!{_LETRA})", re.IGNORECASE)

        def troca(m: re.Match, cat: str = k["categoria"]) -> str:
            contar(cat)
            return _pseudonimo(cofre, cat, m.group(0))

        t = re_k.sub(troca, t)

    # 2. Padrões com validação: só vira CPF/CNS o que confere o dígito.
    def simples(cat: str) -> Callable[[re.Match], str]:
        def f(m: re.Match) -> str:
            contar(cat)
            return _pseudonimo(cofre, cat, m.group(0))
        return f

    def validado(cat: str, valida: Callable[[str], bool]) -> Callable[[re.Match], str]:
        def f(m: re.Match) -> str:
            if not valida(m.group(0)):
                return m.group(0)
            contar(cat)
            return _pseudonimo(cofre, cat, m.group(0))
        return f

    def telefone(m: re.Match) -> str:
        # Número curto ou dose ("500 mg") não é telefone: exige 8+ dígitos.
        if len(_so_digitos(m.group(0))) < 8:
            return m.group(0)
        contar("TELEFONE")
        return _pseudonimo(cofre, "TELEFONE", m.group(0))

    t = _RE_EMAIL.sub(simples("EMAIL"), t)
    t = _RE_CNS.sub(validado("CNS", cns_valido), t)
    t = _RE_CPF.sub(validado("CPF", cpf_valido), t)
    t = _RE_PRONTUARIO.sub(simples("PRONTUARIO"), t)
    t = _RE_DATA.sub(simples("DATA"), t)
    t = _RE_CEP.sub(simples("CEP"), t)
    t = _RE_TELEFONE.sub(telefone, t)

    # 3. Nome depois de gatilho.
    def nome(m: re.Match) -> str:
        contar("PACIENTE")
        return m.group(1) + _pseudonimo(cofre, "PACIENTE", m.group(2))

    t = _RE_NOME_APOS_GATILHO.sub(nome, t)
    return {"texto": t, "contagem": contagem}


# ── Consultas por escopo ─────────────────────────────────────────────────────
# Cada handler recebe a unidade JÁ validada. Enums conferidos aqui.

STATUS_ALERTA = ["novo", "visto", "em_acompanhamento", "justificado"]
PATRULHAS = ["dados", "conteudo", "hermes"]
SEVERIDADES = ["critico", "atencao", "informativo"]

_SEM_UNIDADE = {"erro": "usuário sem unidade vinculada"}
_DESCONHECIDO = {"erro": "comando desconhecido"}


def _enum_ou_nulo(valor: Any, permitidos: list[str]) -> str | None:
    return valor if isinstance(valor, str) and valor in permitidos else None


def _nomes_da_unidade(rpc: Rpc, perfil: str, unidade_id: str) -> list[dict]:
    linhas = _dados(_chamar(rpc, "hermes_unidade_nomes", {"p_perfil": perfil, "p_unidade": unidade_id}))
    return [{"valor": p.get("nome_completo"), "categoria": "PESSOA"} for p in linhas]


def _consulta_aguia(rpc: Rpc, comando: str, perfil: str, unidade_id: str | None) -> Any:
    if not unidade_id:
        return dict(_SEM_UNIDADE)
    p = {"p_perfil": perfil, "p_unidade": unidade_id}
    if comando == "setores":
        return _dados(_chamar(rpc, "hermes_unidade_setores", p))
    if comando == "censo":
        return _dados(_chamar(rpc, "hermes_unidade_censo", p))
    if comando == "indicadores":
        return _dados(_chamar(rpc, "hermes_unidade_indicadores", p))
    if comando == "profissionais":
        # Só a CONTAGEM por papel (ADR 0006): sem nome de colega.
        linhas = _dados(_chamar(rpc, "hermes_unidade_profissionais", p))
        por_papel: dict[str, Any] = {}
        for linha in linhas:
            por_papel[str(linha.get("papel"))] = _inteiro_se_exato(_numero_js(linha.get("total")))
        return {"profissionais_por_papel": por_papel}
    if comando == "resumo":
        # RETURNS jsonb: o próprio resumo, ou null se ainda não gerado.
        data = _chamar(rpc, "hermes_unidade_resumo", p)
        return data if data is not None else {"mensagem": "Resumo ainda não gerado para esta unidade."}
    return dict(_DESCONHECIDO)


def _consulta_garca(rpc: Rpc, comando: str, perfil: str, unidade_id: str | None) -> Any:
    if not unidade_id:
        return dict(_SEM_UNIDADE)
    if comando in ("indicadores", "censo"):
        return _consulta_aguia(rpc, comando, perfil, unidade_id)
    if comando == "internacoes":
        # Só a CONTAGEM por status — nunca a lista de pacientes (LGPD).
        linhas = _dados(_chamar(rpc, "hermes_unidade_internacoes_por_status", {"p_perfil": perfil, "p_unidade": unidade_id}))
        por_status: dict[str, Any] = {}
        total: Any = 0
        for linha in linhas:
            n = _inteiro_se_exato(_numero_js(linha.get("total")))
            por_status[str(linha.get("status"))] = n
            total = _inteiro_se_exato(total + n)
        return {"por_status": por_status, "total": total}
    return dict(_DESCONHECIDO)


def _consulta_sentinela(rpc: Rpc, comando: str, perfil: str, unidade_id: str | None, args: dict, super_admin: bool) -> Any:
    if comando == "alertas":
        status = _enum_ou_nulo(args.get("status"), STATUS_ALERTA) or "novo"
        return _dados(_chamar(rpc, "hermes_alertas_escala", {"p_perfil": perfil, "p_unidade": unidade_id, "p_status": [status]}))
    if comando == "relatorio":
        # O relatório é GLOBAL: só suporte técnico.
        if not super_admin:
            return {"mensagem": "O relatório semanal é consultado na plataforma."}
        data = _chamar(rpc, "hermes_relatorio_semanal_ultimo", {"p_perfil": perfil})
        return [data] if _verdadeiro_js(data) else []
    return dict(_DESCONHECIDO)


def _consulta_seguranca(rpc: Rpc, comando: str, perfil: str, args: dict) -> Any:
    if comando == "incidentes":
        return _dados(_chamar(rpc, "hermes_incidentes_abertos", {
            "p_perfil": perfil,
            "p_patrulha": _enum_ou_nulo(args.get("patrulha"), PATRULHAS),
            "p_severidade": _enum_ou_nulo(args.get("severidade"), SEVERIDADES),
        }))
    if comando == "quarentena":
        return _dados(_chamar(rpc, "hermes_quarentena_pendente", {"p_perfil": perfil}))
    return dict(_DESCONHECIDO)


def _consulta_operacional(rpc: Rpc, comando: str, unidade_id: str | None, args: dict, ident: dict) -> Any:
    if not unidade_id:
        return dict(_SEM_UNIDADE)
    if comando in ("setores", "censo", "indicadores", "profissionais"):
        return _consulta_aguia(rpc, comando, ident["perfilId"], unidade_id)
    if comando == "notificacoes":
        dias = _numero_js(args.get("dias"))
        janela = dias if (math.isfinite(dias) and dias > 0 and dias <= 90) else 7
        linhas = _dados(_chamar(rpc, "hermes_minhas_notificacoes", {
            "p_perfil": ident["perfilId"],
            "p_unidade": unidade_id,
            "p_dias": _inteiro_se_exato(janela),
        }))
        # Avisos citam colegas pelo nome: o texto passa pela desidentificação (ADR 0006).
        conhecidos = _nomes_da_unidade(rpc, ident["perfilId"], unidade_id)
        cofre = criar_cofre()
        return [
            {**n, "mensagem": desidentificar(n.get("mensagem") if n.get("mensagem") is not None else "", cofre, conhecidos)["texto"]}
            for n in linhas
        ]
    return dict(_DESCONHECIDO)


_RE_DIA = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")


def _consulta_escala(rpc: Rpc, comando: str, ident: dict, unidade_id: str | None, args: dict, hoje: Callable[[], str]) -> Any:
    if comando == "meus_plantoes":
        periodo = _enum_ou_nulo(args.get("periodo"), ["hoje", "semana", "mes"]) or "semana"
        return _dados(_chamar(rpc, "hermes_plantoes_do_perfil", {
            "p_perfil": ident["perfilId"],  # ← nunca o que veio no argumento
            "p_dias": 1 if periodo == "hoje" else 7 if periodo == "semana" else 31,
        }))
    if comando == "plantao_do_dia":
        # Escala de toda a unidade: só gestor/admin (ou suporte global).
        if not (ident.get("superAdmin") is True or ident.get("papel") in ("gestor", "admin")):
            return {"mensagem": "Posso mostrar apenas os seus próprios plantões."}
        if not unidade_id:
            return dict(_SEM_UNIDADE)
        data = args.get("data")
        dia = data if isinstance(data, str) and _RE_DIA.fullmatch(data) else hoje()
        linhas = _dados(_chamar(rpc, "hermes_plantao_do_dia", {"p_unidade": unidade_id, "p_dia": dia}))
        return {"dia": dia, "plantoes": linhas}
    return dict(_DESCONHECIDO)


def _consulta_infra(rpc: Rpc, comando: str, perfil: str) -> Any:
    if comando != "integridade":
        return dict(_DESCONHECIDO)
    data = _chamar(rpc, "hermes_integridade_resumo", {"p_perfil": perfil})
    return data if data is not None else {"incidentes_abertos": 0, "quarentena_pendente": 0}


# ── Pontos de entrada (equivalentes às rotas HTTP) ───────────────────────────

_RE_COMANDO = re.compile(r"[a-z_]{1,32}")
_FALHA = {"ok": False, "erro": "falha interna"}
_NEGADO = {"ok": False, "erro": "nao_autorizado", "resposta": RESPOSTA_GENERICA}


def almanaque(rpc: Rpc, texto: Any) -> dict:
    """Escopo almanaque de /skill/consulta. Não depende de quem pergunta."""
    texto = texto[:300] if isinstance(texto, str) else ""
    if len(texto.strip()) < 3:
        return {"ok": False, "erro": "informe a pergunta"}
    try:
        achados = _dados(_chamar(rpc, "hermes_almanaque_buscar", {"p_texto": texto, "p_limite": 2}))
        return {"ok": True, "dados": achados}
    except Exception as e:  # noqa: BLE001
        log.error("[skill-api] falha no almanaque: %s", e)
        return dict(_FALHA)


def consultar(
    rpc: Rpc,
    canal: Any,
    identificador: Any,
    escopo: Any,
    comando: Any,
    args: dict | None = None,
    hoje: Callable[[], str] = _hoje_brasilia,
) -> dict:
    """/skill/consulta. ``canal``/``identificador`` vêm da SESSÃO, nunca do modelo."""
    comando = comando if isinstance(comando, str) else ""
    args = args if isinstance(args, dict) else {}

    if (escopo not in ESCOPOS and escopo != "almanaque") or not _RE_COMANDO.fullmatch(comando):
        return {"ok": False, "erro": "escopo ou comando inválido"}
    if escopo == "almanaque":
        if comando != "buscar":
            return {"ok": False, "erro": "informe a pergunta"}
        return almanaque(rpc, args.get("texto"))

    # Só o caminho canal+identificador (o plugin nunca manda wa_id).
    if not isinstance(canal, str) or canal not in CANAIS or not isinstance(identificador, str) or not identificador:
        return {"ok": False, "erro": "sujeito obrigatório (wa_id ou canal+identificador)"}

    try:
        ident = resolver_identidade_por_canal(rpc, canal, identificador)
    except Exception as e:  # noqa: BLE001
        log.error("[skill-api] falha ao resolver identidade: %s", e)
        return dict(_FALHA)

    # Desconhecido, sem papel ou sem privilégio → MESMA resposta genérica.
    if not ident or not autorizado(escopo, ident):
        log.warning("[skill-api] acesso negado escopo=%s comando=%s perfil=%s papel=%s", escopo, comando,
                    ident.get("perfilId") if ident else None, ident.get("papel") if ident else None)
        return dict(_NEGADO)

    pedida = args.get("unidade_id")
    unidade = resolver_unidade(ident, pedida if isinstance(pedida, str) else None)
    # O papel que vale é o da unidade consultada (auditoria 27/09).
    if unidade["ok"] and unidade["unidadeId"] and unidade["unidadeId"] != ident.get("unidadeId"):
        ident = {**ident, "papel": papel_na_unidade(ident, unidade["unidadeId"]), "unidadeId": unidade["unidadeId"]}
    if not unidade["ok"]:
        # Cross-tenant: registra no audit_log via RPC. Como no TS, falha do
        # registro não muda a resposta (o supabase-js não lança).
        log.warning("[skill-api] tentativa cross-tenant bloqueada escopo=%s perfil=%s", escopo, ident.get("perfilId"))
        try:
            _chamar(rpc, "hermes_audit_registrar", {
                "p_perfil": ident.get("perfilId"),
                "p_phone": identificador,
                "p_direction": "tool",
                "p_tool_name": "skill_cross_tenant_bloqueado",
                "p_tool_args": {"escopo": escopo, "unidade_pedida": pedida},
                "p_resumo": "[SkillAPI] Tentativa de acesso a unidade não vinculada",
            })
        except Exception as e:  # noqa: BLE001
            log.error("[skill-api] falha ao registrar cross-tenant: %s", e)
        return dict(_NEGADO)

    uid = unidade["unidadeId"]
    perfil = ident.get("perfilId")
    try:
        if escopo == "aguia":
            dados = _consulta_aguia(rpc, comando, perfil, uid)
        elif escopo == "garca":
            dados = _consulta_garca(rpc, comando, perfil, uid)
        elif escopo == "operacional":
            dados = _consulta_operacional(rpc, comando, uid, args, ident)
        elif escopo == "escala":
            dados = _consulta_escala(rpc, comando, ident, uid, args, hoje)
        elif escopo == "sentinela":
            dados = _consulta_sentinela(rpc, comando, perfil, uid, args, ident.get("superAdmin") is True)
        elif escopo == "seguranca":
            dados = _consulta_seguranca(rpc, comando, perfil, args)
        else:  # infra
            dados = _consulta_infra(rpc, comando, perfil)
        return {"ok": True, "dados": dados}
    except Exception as e:  # noqa: BLE001
        log.error("[skill-api] falha na consulta escopo=%s comando=%s: %s", escopo, comando, e)
        return dict(_FALHA)


# Tentativas de código erradas por canal:identificador (memória do processo).
TENTATIVAS_VINCULO: dict[str, list[float]] = {}
_JANELA_MS = 15 * 60_000
_MAX_TENTATIVAS = 5


def _agora_ms() -> float:
    return time.time() * 1000


def vincular(rpc: Rpc, canal: Any, identificador: Any, codigo: Any, agora: Callable[[], float] = _agora_ms) -> dict:
    """/skill/vincular. Até 5 tentativas erradas por identificador a cada 15 min."""
    identificador = identificador if isinstance(identificador, str) else ""
    codigo = _so_digitos(codigo) if isinstance(codigo, str) else ""
    if canal not in CANAIS or not _RE_IDENTIFICADOR.fullmatch(identificador) or len(codigo) != 6:
        return {"ok": False, "erro": "código inválido"}

    chave = f"{canal}:{identificador}"
    t = agora()
    tentativas = [x for x in TENTATIVAS_VINCULO.get(chave, []) if t - x < _JANELA_MS]
    if len(tentativas) >= _MAX_TENTATIVAS:
        return {"ok": False, "erro": "Muitas tentativas. Gere um código novo e tente em 15 minutos."}

    try:
        perfil_id = _chamar(rpc, "confirmar_vinculo_hermes", {
            "p_canal": canal,
            "p_identificador": identificador,
            "p_codigo": codigo,
        })
    except Exception as e:  # noqa: BLE001
        log.error("[skill-api] falha ao confirmar vínculo: %s", e)
        return dict(_FALHA)
    if not _verdadeiro_js(perfil_id):
        TENTATIVAS_VINCULO[chave] = [*tentativas, t]
        return {"ok": False, "erro": "Código errado, vencido ou já usado. Gere um novo no seu Perfil."}
    TENTATIVAS_VINCULO.pop(chave, None)
    try:
        ident = resolver_identidade_por_canal(rpc, canal, identificador)
    except Exception as e:  # noqa: BLE001 — no TS isto virava o 500 padrão do Fastify
        log.error("[skill-api] vínculo gravado, mas falhou ao reler a identidade: %s", e)
        return dict(_FALHA)
    log.info("[skill-api] canal vinculado canal=%s perfil=%s", canal, perfil_id)
    return {"ok": True, "nome": ident.get("nome") if ident else None, "papel": ident.get("papel") if ident else None}
