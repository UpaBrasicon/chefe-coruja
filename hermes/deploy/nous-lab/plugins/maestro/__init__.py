"""Maestro da Coruja Lab (decisão do RT, 03/10/2026).

A Lab passa a acompanhar as quatro Corujas de saúde (corujinha, gestora,
clinica, suporte) e a melhorá-las PROPONDO skills (instruções em texto).

- **Só números agregados.** ``numeros_corujas`` lê um JSON de contagens
  (gerado fora daqui a cada hora e montado SOMENTE LEITURA em
  /opt/maestro/numeros). Nada de dado de paciente ou de profissional.
- **Propor, nunca aplicar.** ``propor_skill`` grava a proposta em
  /opt/data/maestro/propostas/<id>/ (SKILL.md + proposta.json). Aprovar só
  muda o status; quem instala é o RT, no host, com aplicar-propostas.sh
  (que valida de novo e pede confirmação).
- **Quem aprova vem da sessão do canal** (como o _sujeito() do plugin
  chefe-coruja), nunca de argumento, e precisa estar em MAESTRO_APROVADORES.

As regras de conteúdo são simples e explícitas (expressões regulares): nada
que pareça dado pessoal, nada que mande usar ferramenta que as Corujas de
saúde não têm, e nenhuma dose (dose nunca entra por skill).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

TOOLSET = "maestro"

# Caminhos (podem ser trocados por variável de ambiente; os testes usam isso)
NUMEROS_PADRAO = "/opt/maestro/numeros/numeros.json"
PROPOSTAS_PADRAO = "/opt/data/maestro/propostas"

AGENTES = ("corujinha", "gestora", "clinica", "suporte")
STATUS = ("pendente", "aprovada", "rejeitada", "aplicada", "removida")
MAX_CONTEUDO = 12000
MAX_SKILL_BYTES = 16384  # SKILL.md inteiro (frontmatter + corpo), conferido também no host
IDADE_MAX_HORAS = 3
MAX_DADOS_CHARS = 60000

RX_NOME = re.compile(r"^[a-z0-9-]{3,48}$")
RX_NOME_KEBAB = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RX_ID = re.compile(r"^\d{8}-\d{4}-[a-z0-9-]{3,48}$")

# ── Regras de conteúdo ───────────────────────────────────────────────────────
# Dado pessoal: padrões simples. Falso positivo é aceitável (reescreve-se a
# proposta); falso negativo é o que não pode.
DADO_PESSOAL = [
    ("CPF ou telefone (11 dígitos)", re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b")),
    ("CNS (cartão SUS)", re.compile(r"\b[1-9]\d{2}[ .]\d{4}[ .]\d{4}[ .]\d{4}\b|\b[1-9]\d{14}\b")),
    ("telefone", re.compile(r"\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}|\b\d{2}\s9\d{4}-\d{4}\b|\b9\d{4}-\d{4}\b|\+55\s?\d|\b\d{10}\b")),
    ("e-mail", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("data completa (use mês/ano)", re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}-\d{1,2}-\d{4}\b")),
]

# Ferramentas que as Corujas de saúde NÃO têm (elas só leem skills e usam o
# plugin chefe-coruja). Skill que manda usar terminal/arquivo/execução é recusada.
FERRAMENTA_PROIBIDA = re.compile(
    r"\b(terminal|file|execute|execute_code|read_file|write_file|search_files|shell|bash|sudo|subprocess|skill_manage)\b",
    re.I,
)

# Dose: número + unidade (mg, mcg, mL/h, UI/kg...) ou unidade de dose por peso/tempo.
# Vale para TODOS os agentes (dose nunca vem por skill); na clínica é a regra central.
DOSE = re.compile(
    r"\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|ug|g|mL|ml|L|UI|U|mEq|mmol|gotas|gts)(?![A-Za-z])"
    r"|\b(?:mg|mcg|µg|μg|ug|mL|ml|UI|U|mEq|mmol)\s*/\s*(?:kg|h|min|m2|m²)\b"
)

CONTROLE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _j(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False)


def _agora() -> datetime:
    """Agora em Brasília (o contêiner tem TZ=America/Sao_Paulo; sem tzdata, UTC-3)."""
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("America/Sao_Paulo"))
    except Exception:  # noqa: BLE001 — zoneinfo/tzdata ausente
        return datetime.now(timezone(timedelta(hours=-3)))


def _pasta_propostas() -> Path:
    return Path(os.environ.get("MAESTRO_PROPOSTAS", PROPOSTAS_PADRAO))


def _arquivo_numeros() -> Path:
    return Path(os.environ.get("MAESTRO_NUMEROS", NUMEROS_PADRAO))


def verificar_texto(texto: str) -> list[str]:
    """Erros de conteúdo (dado pessoal, ferramenta proibida, dose, controle)."""
    erros = []
    if CONTROLE.search(texto):
        erros.append("caractere de controle no texto")
    for rotulo, rx in DADO_PESSOAL:
        if rx.search(texto):
            erros.append(f"parece dado pessoal: {rotulo}")
    m = FERRAMENTA_PROIBIDA.search(texto)
    if m:
        erros.append(f"cita ferramenta que as Corujas de saúde não têm: '{m.group(0)}'")
    m = DOSE.search(texto)
    if m:
        erros.append(f"parece dose ('{m.group(0)}'): dose nunca entra por skill")
    return erros


def validar_proposta(agente: str, nome: str, descricao: str, conteudo: str, motivo: str) -> list[str]:
    erros = []
    if agente not in AGENTES:
        erros.append(f"agente deve ser um de: {', '.join(AGENTES)}")
    if not (RX_NOME.match(nome) and RX_NOME_KEBAB.match(nome)):
        erros.append("nome em kebab-case: 3 a 48 caracteres de a-z, 0-9 e hífen (ex.: resposta-escala-curta)")
    if not 10 <= len(descricao) <= 300 or "\n" in descricao or "\r" in descricao:
        erros.append("descricao: uma linha, 10 a 300 caracteres")
    if not conteudo.strip():
        erros.append("conteudo vazio")
    elif len(conteudo) > MAX_CONTEUDO:
        erros.append(f"conteudo passa de {MAX_CONTEUDO} caracteres")
    elif conteudo.lstrip().startswith("---"):
        erros.append("conteudo sem frontmatter (o maestro escreve o cabeçalho)")
    if not 10 <= len(motivo) <= 1000:
        erros.append("motivo: 10 a 1000 caracteres (qual número ou problema justifica)")
    for campo, texto in (("descricao", descricao), ("conteudo", conteudo), ("motivo", motivo)):
        erros += [f"{campo}: {e}" for e in verificar_texto(texto)]
    return erros


def montar_skill(nome: str, descricao: str, conteudo: str) -> str:
    # descrição como string JSON: é também uma string YAML válida entre aspas
    return f"---\nname: {nome}\ndescription: {json.dumps(descricao, ensure_ascii=False)}\n---\n\n{conteudo.strip()}\n"


def ler_frontmatter(texto: str) -> tuple[dict, str] | None:
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", texto, re.S)
    if not m:
        return None
    campos = {}
    for linha in m.group(1).splitlines():
        r = re.match(r"^([a-z_]+):\s*(.*)$", linha)
        if not r:
            return None  # só name/description em uma linha cada
        valor = r.group(2).strip()
        if valor.startswith('"'):
            try:
                valor = json.loads(valor)
            except ValueError:
                return None
        campos[r.group(1)] = valor
    return campos, m.group(2)


def validar_skill_arquivo(caminho: Path, agente: str, nome: str) -> list[str]:
    """Validação do SKILL.md já gravado (usada na aprovação e pelo script do host)."""
    erros = []
    if agente not in AGENTES:
        erros.append("agente inválido")
    if not (RX_NOME.match(nome or "") and RX_NOME_KEBAB.match(nome or "")):
        erros.append("nome inválido")
    try:
        bruto = caminho.read_bytes()
    except OSError:
        return erros + ["SKILL.md ausente"]
    if len(bruto) > MAX_SKILL_BYTES:
        erros.append(f"SKILL.md passa de {MAX_SKILL_BYTES} bytes")
    try:
        texto = bruto.decode("utf-8")
    except UnicodeDecodeError:
        return erros + ["SKILL.md não é UTF-8"]
    fm = ler_frontmatter(texto)
    if not fm:
        return erros + ["frontmatter inválido (só name e description, uma linha cada)"]
    campos, corpo = fm
    if set(campos) != {"name", "description"}:
        erros.append("frontmatter deve ter só name e description")
    if campos.get("name") != nome:
        erros.append("name do frontmatter diferente do nome da proposta")
    if len(corpo) > MAX_CONTEUDO + 10:
        erros.append("corpo grande demais")
    erros += verificar_texto(str(campos.get("description", "")) + "\n" + corpo)
    return erros


def _sha256(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


# ── numeros_corujas ──────────────────────────────────────────────────────────


def _dia(v) -> date | None:
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _num(v) -> int:
    if isinstance(v, bool):
        return 0
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, dict):
        return _num(v.get("total", 0))
    if isinstance(v, list):
        return len(v)
    return 0


def _linhas(obj, campo: str, numero_e_o_campo: bool = False) -> list[tuple[str, date, int]]:
    """Normaliza 'por origem e dia' para (origem, dia, valor).

    Aceita {origem: {dia: n | {total, bloqueados...}}} ou
    [{origem, dia|data, total, bloqueados...}]. Número solto vale como
    ``total`` (no gateway) ou como o próprio campo (numero_e_o_campo=True,
    p.ex. a chave ``bloqueados`` de topo).
    """
    direto = campo == "total" or numero_e_o_campo
    saida = []
    if isinstance(obj, dict):
        for origem, por_dia in obj.items():
            if not isinstance(por_dia, dict):
                continue
            for d, v in por_dia.items():
                dia = _dia(d)
                if dia is None:
                    continue
                if isinstance(v, dict):
                    valor = v.get(campo, v.get("total", 0) if numero_e_o_campo else 0)
                else:
                    valor = v if direto else 0
                saida.append((str(origem), dia, _num(valor)))
    elif isinstance(obj, list):
        for row in obj:
            if not isinstance(row, dict):
                continue
            dia = _dia(row.get("dia") or row.get("data"))
            if dia is None:
                continue
            valor = row.get(campo, row.get("total", 0) if numero_e_o_campo else 0)
            saida.append((str(row.get("origem", "?")), dia, _num(valor)))
    return saida


# Tipos de bloqueio (decisão do RT 03/10/2026): a função do banco já devolve
# só estas chaves fixas; o que vier fora delas conta como "outro" aqui também.
TIPOS_BLOQUEIO = ("nome_ner", "data_completa", "digitos_11", "digitos_15", "email", "outro")
TOP_TIPOS = 3


def _linhas_tipos(obj) -> list[tuple[str, date, dict]]:
    """(origem, dia, {tipo: n}) das linhas do gateway que têm ``tipos_bloqueio``.

    Mesmos dois formatos de ``_linhas``. Linha sem o campo (numeros.json antigo)
    simplesmente não entra.
    """
    saida = []
    linhas = []
    if isinstance(obj, dict):
        for origem, por_dia in obj.items():
            if isinstance(por_dia, dict):
                linhas += [(origem, d, v) for d, v in por_dia.items()]
    elif isinstance(obj, list):
        linhas = [(r.get("origem", "?"), r.get("dia") or r.get("data"), r) for r in obj if isinstance(r, dict)]
    for origem, d, v in linhas:
        dia = _dia(d)
        tipos = v.get("tipos_bloqueio") if isinstance(v, dict) else None
        if dia is None or not isinstance(tipos, dict):
            continue
        norm: dict[str, int] = {}
        for t, n in tipos.items():
            chave = t if t in TIPOS_BLOQUEIO else "outro"
            norm[chave] = norm.get(chave, 0) + max(_num(n), 0)
        saida.append((str(origem), dia, norm))
    return saida


def _top_tipos(contagem: dict[str, int]) -> list[dict]:
    itens = sorted(((t, n) for t, n in contagem.items() if n > 0), key=lambda x: (-x[1], x[0]))
    return [{"tipo": t, "total": n} for t, n in itens[:TOP_TIPOS]]


def _agente_da_origem(origem: str) -> str:
    return origem.split(":", 1)[0].strip().lower() or "?"


def _gerado_em(dados: dict) -> datetime | None:
    v = dados.get("gerado_em")
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_agora().tzinfo)
    return dt


def _vigias_com_falha(vigias) -> list[str]:
    itens = []
    if isinstance(vigias, dict):
        itens = [(str(k), v) for k, v in vigias.items()]
    elif isinstance(vigias, list):
        itens = [(str(v.get("job") or v.get("nome") or "?"), v) for v in vigias if isinstance(v, dict)]
    falhas = []
    for nome, v in itens:
        if not isinstance(v, dict):
            continue
        if v.get("ok") is False or _num(v.get("falhas", v.get("fails", 0))) > 0:
            falhas.append(nome)
    return sorted(falhas)


def resumir(dados: dict, agora: datetime | None = None) -> tuple[dict, list[str]]:
    agora = agora or _agora()
    avisos = []
    gerado = _gerado_em(dados)
    idade_h = None
    if gerado is None:
        avisos.append("numeros.json sem gerado_em válido")
    else:
        idade_h = round((agora - gerado).total_seconds() / 3600, 1)
        if idade_h > IDADE_MAX_HORAS:
            avisos.append(f"dados velhos: gerados há {idade_h} h (o normal é a cada hora)")

    gw = dados.get("gateway") or {}
    totais = _linhas(gw, "total")
    bloq = _linhas(gw, "bloqueados")
    if not any(v for *_x, v in bloq) and dados.get("bloqueados") is not None:
        bloq = _linhas(dados.get("bloqueados"), "bloqueados", numero_e_o_campo=True)
    dias = [d for _o, d, _v in totais + bloq]
    ref = gerado.date() if gerado else (max(dias) if dias else None)

    por_agente: dict[str, dict] = {}
    if ref:
        inicio7 = ref - timedelta(days=6)
        for fonte, chave in ((totais, "total"), (bloq, "bloqueados")):
            for origem, dia, v in fonte:
                if not inicio7 <= dia <= ref:
                    continue
                a = por_agente.setdefault(_agente_da_origem(origem), {"total_1d": 0, "bloqueados_1d": 0, "total_7d": 0, "bloqueados_7d": 0})
                a[f"{chave}_7d"] += v
                if dia == ref:
                    a[f"{chave}_1d"] += v
        # Por que bloqueou (só o tipo): só aparece se o numeros.json trouxer
        # tipos_bloqueio — arquivo antigo continua com o resumo de antes.
        tipos_por_agente: dict[str, tuple[dict, dict]] = {}
        for origem, dia, tipos in _linhas_tipos(gw):
            if not inicio7 <= dia <= ref:
                continue
            t1, t7 = tipos_por_agente.setdefault(_agente_da_origem(origem), ({}, {}))
            for t, n in tipos.items():
                t7[t] = t7.get(t, 0) + n
                if dia == ref:
                    t1[t] = t1.get(t, 0) + n
        for agente, (t1, t7) in tipos_por_agente.items():
            if not any(t7.values()):
                continue
            a = por_agente.setdefault(agente, {"total_1d": 0, "bloqueados_1d": 0, "total_7d": 0, "bloqueados_7d": 0})
            a["tipos_bloqueio_1d"] = _top_tipos(t1)
            a["tipos_bloqueio_7d"] = _top_tipos(t7)
        for a in por_agente.values():
            a["taxa_bloqueio_1d_pct"] = round(100 * a["bloqueados_1d"] / a["total_1d"], 1) if a["total_1d"] else None
            a["taxa_bloqueio_7d_pct"] = round(100 * a["bloqueados_7d"] / a["total_7d"], 1) if a["total_7d"] else None
            t1, t7 = a["taxa_bloqueio_1d_pct"], a["taxa_bloqueio_7d_pct"]
            if t1 is not None and t7 is not None and t1 > max(2 * t7, t7 + 5):
                avisos.append("taxa de bloqueio subiu acima do normal em algum agente (ver por_agente)")

    falhas = _vigias_com_falha(dados.get("vigias"))
    if falhas:
        avisos.append(f"vigias com falha: {', '.join(falhas)}")
    resumo = {
        "gerado_em": dados.get("gerado_em"),
        "idade_horas": idade_h,
        "janela_dias": dados.get("janela_dias"),
        "dia_referencia": ref.isoformat() if ref else None,
        "nota": (
            "1d = dia de referência (data de gerado_em, em parte do dia); 7d = os 7 dias até ele; "
            "tipos_bloqueio_* = até 3 motivos de bloqueio mais frequentes, só o tipo (nome_ner, data_completa, "
            "digitos_11, digitos_15, email, outro), nunca o texto"
        ),
        "por_agente": dict(sorted(por_agente.items())),
        "vigias_com_falha": falhas,
    }
    return resumo, sorted(set(avisos), key=avisos.index)


NUMEROS_SCHEMA = {
    "name": "numeros_corujas",
    "description": (
        "Números AGREGADOS das quatro Corujas de saúde (gateway por origem e dia, bloqueados, resíduos, "
        "incidentes, alertas, notificações, vigias). Devolve os dados e um resumo: taxa de bloqueio por "
        "agente no último dia x 7 dias, principais TIPOS de bloqueio por agente (nome, data, dígitos, e-mail; "
        "nunca o texto), vigias com falha e idade dos dados. Sem dado pessoal."
    ),
    "parameters": {"type": "object", "properties": {}},
}


def _numeros(_args: dict, **_kw) -> str:
    arq = _arquivo_numeros()
    try:
        dados = json.loads(arq.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return _j({"ok": False, "erro": "numeros.json não encontrado", "avisos": ["sem números: o gerador de hora em hora parou ou a pasta não está montada"]})
    except (OSError, ValueError) as e:
        return _j({"ok": False, "erro": f"numeros.json ilegível ({type(e).__name__})"})
    if not isinstance(dados, dict):
        return _j({"ok": False, "erro": "numeros.json fora do formato (esperado objeto)"})
    resumo, avisos = resumir(dados)
    saida = {"ok": True, "resumo": resumo, "avisos": avisos, "dados": dados}
    if len(_j(dados)) > MAX_DADOS_CHARS:
        saida["dados"] = None
        saida["dados_cortados"] = f"dados brutos passam de {MAX_DADOS_CHARS} caracteres; use o resumo"
    return _j(saida)


# ── propostas ────────────────────────────────────────────────────────────────


def _ler_proposta(pid: str) -> tuple[Path, dict] | None:
    if not RX_ID.match(pid or ""):
        return None
    pasta = _pasta_propostas() / pid
    try:
        meta = json.loads((pasta / "proposta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return pasta, meta


def _gravar_texto(caminho: Path, texto: str) -> None:
    """Grava com fim de linha \\n (sem conversão) e troca atômica."""
    tmp = caminho.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)
    os.replace(tmp, caminho)


def _gravar_json(caminho: Path, obj: dict) -> None:
    _gravar_texto(caminho, json.dumps(obj, ensure_ascii=False, indent=2) + "\n")


def _quem() -> str | None:
    """Usuário da SESSÃO do Telegram (preenchido pelo gateway), nunca de argumento."""
    try:
        # Import aqui: os testes rodam sem o Nous (injetam um gateway.session_context falso).
        from gateway.session_context import get_session_env
    except ImportError:
        return None
    if get_session_env("HERMES_SESSION_PLATFORM", "") != "telegram":
        return None
    u = str(get_session_env("HERMES_SESSION_USER_ID", "") or "").strip()
    return u or None


def _aprovadores() -> set[str]:
    return {x for x in re.split(r"[,\s]+", os.environ.get("MAESTRO_APROVADORES", "")) if x}


PROPOR_SCHEMA = {
    "name": "propor_skill",
    "description": (
        "Propõe uma skill (instrução em texto, markdown) para uma Coruja de saúde. NÃO instala: fica "
        "'pendente' até o RT aprovar, e quem instala é o script do host. Recusada se tiver algo que "
        "pareça dado pessoal (CPF, CNS, telefone, e-mail, data completa), se mandar usar terminal/"
        "arquivos/execução, ou se tiver dose (mg, mcg, mL/h, UI/kg...)."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "agente": {"type": "string", "enum": list(AGENTES)},
            "nome": {"type": "string", "description": "kebab-case, 3-48 (ex.: resposta-escala-curta)"},
            "descricao": {"type": "string", "description": "uma linha: quando a Coruja deve usar a skill"},
            "conteudo": {"type": "string", "description": "corpo do SKILL.md em markdown, sem frontmatter (até 12000)"},
            "motivo": {"type": "string", "description": "qual número ou problema justifica a proposta"},
        },
        "required": ["agente", "nome", "descricao", "conteudo", "motivo"],
    },
}


def _propor(args: dict, **_kw) -> str:
    agente = str(args.get("agente") or "").strip().lower()
    nome = str(args.get("nome") or "").strip()
    descricao = str(args.get("descricao") or "").strip()
    conteudo = str(args.get("conteudo") or "")
    motivo = str(args.get("motivo") or "").strip()
    erros = validar_proposta(agente, nome, descricao, conteudo, motivo)
    if erros:
        return _j({"ok": False, "erro": "proposta recusada", "motivos": erros})
    raiz = _pasta_propostas()
    for p in raiz.glob("*/proposta.json") if raiz.exists() else []:
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if m.get("agente") == agente and m.get("nome") == nome and m.get("status") == "pendente":
            return _j({"ok": False, "erro": f"já há proposta pendente para {agente}/{nome}: {m.get('id')} (rejeite-a antes)"})
    agora = _agora()
    pid = f"{agora:%Y%m%d-%H%M}-{nome}"
    pasta = raiz / pid
    try:
        pasta.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        return _j({"ok": False, "erro": f"já existe a proposta {pid}; tente daqui a um minuto"})
    _gravar_texto(pasta / "SKILL.md", montar_skill(nome, descricao, conteudo))
    meta = {
        "id": pid,
        "agente": agente,
        "nome": nome,
        "descricao": descricao,
        "motivo": motivo,
        "criada_em": agora.isoformat(timespec="seconds"),
        "proposta_por": _quem(),
        "status": "pendente",
    }
    _gravar_json(pasta / "proposta.json", meta)
    return _j({"ok": True, "id": pid, "status": "pendente", "proximo_passo": "o RT revisa (ver_proposta) e aprova ou rejeita; aprovar não instala"})


LISTAR_SCHEMA = {
    "name": "listar_propostas",
    "description": "Lista as propostas de skill (id, agente, nome, status, criada_em), da mais nova para a mais antiga.",
    "parameters": {
        "type": "object",
        "properties": {"status": {"type": "string", "enum": list(STATUS)}},
    },
}


def _listar(args: dict, **_kw) -> str:
    filtro = str(args.get("status") or "").strip().lower()
    if filtro and filtro not in STATUS:
        return _j({"ok": False, "erro": f"status deve ser um de: {', '.join(STATUS)}"})
    raiz = _pasta_propostas()
    itens = []
    for p in sorted(raiz.glob("*/proposta.json"), reverse=True) if raiz.exists() else []:
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if filtro and m.get("status") != filtro:
            continue
        itens.append({k: m.get(k) for k in ("id", "agente", "nome", "status", "criada_em")})
    return _j({"ok": True, "total": len(itens), "propostas": itens[:50]})


VER_SCHEMA = {
    "name": "ver_proposta",
    "description": "Mostra uma proposta de skill: metadados e o SKILL.md completo.",
    "parameters": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
}


def _ver(args: dict, **_kw) -> str:
    r = _ler_proposta(str(args.get("id") or "").strip())
    if not r:
        return _j({"ok": False, "erro": "proposta não encontrada"})
    pasta, meta = r
    try:
        skill = (pasta / "SKILL.md").read_text(encoding="utf-8")
    except OSError:
        skill = None
    return _j({"ok": True, "proposta": meta, "skill_md": skill})


APROVAR_SCHEMA = {
    "name": "aprovar_proposta",
    "description": (
        "Aprova uma proposta pendente. Só vale para quem está na lista de aprovadores (identificado pela "
        "sessão do Telegram). NÃO instala: a instalação é o aplicar-propostas.sh no host."
    ),
    "parameters": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
}

REJEITAR_SCHEMA = {
    "name": "rejeitar_proposta",
    "description": "Rejeita uma proposta pendente (ou aprovada e ainda não aplicada). Só para aprovadores.",
    "parameters": {
        "type": "object",
        "properties": {"id": {"type": "string"}, "motivo": {"type": "string"}},
        "required": ["id", "motivo"],
    },
}


def _decidir(args: dict, novo: str) -> str:
    quem = _quem()
    if not quem:
        return _j({"ok": False, "erro": "aprovação só pelo Telegram, por quem está na lista de aprovadores"})
    if quem not in _aprovadores():
        return _j({"ok": False, "erro": "você não está na lista de aprovadores (MAESTRO_APROVADORES)"})
    r = _ler_proposta(str(args.get("id") or "").strip())
    if not r:
        return _j({"ok": False, "erro": "proposta não encontrada"})
    pasta, meta = r
    atual = meta.get("status")
    agora = _agora().isoformat(timespec="seconds")
    if novo == "aprovada":
        if atual != "pendente":
            return _j({"ok": False, "erro": f"só proposta pendente pode ser aprovada (está {atual})"})
        erros = validar_skill_arquivo(pasta / "SKILL.md", meta.get("agente", ""), meta.get("nome", ""))
        if erros:
            return _j({"ok": False, "erro": "SKILL.md não passa na validação", "motivos": erros})
        meta.update(status="aprovada", aprovada_por=quem, aprovada_em=agora, sha256=_sha256(pasta / "SKILL.md"))
        _gravar_json(pasta / "proposta.json", meta)
        return _j({"ok": True, "id": meta["id"], "status": "aprovada", "proximo_passo": "no host: sh aplicar-propostas.sh (instala com confirmação e reinicia a Coruja)"})
    motivo = str(args.get("motivo") or "").strip()[:500]
    if len(motivo) < 3:
        return _j({"ok": False, "erro": "informe o motivo da rejeição"})
    if atual not in ("pendente", "aprovada"):
        return _j({"ok": False, "erro": f"só proposta pendente ou aprovada pode ser rejeitada (está {atual})"})
    meta.update(status="rejeitada", rejeitada_por=quem, rejeitada_em=agora, motivo_rejeicao=motivo)
    _gravar_json(pasta / "proposta.json", meta)
    return _j({"ok": True, "id": meta["id"], "status": "rejeitada"})


def _aprovar(args: dict, **_kw) -> str:
    return _decidir(args, "aprovada")


def _rejeitar(args: dict, **_kw) -> str:
    return _decidir(args, "rejeitada")


def register(ctx) -> None:
    # só no agente Lab: as Corujas de saúde não propõem nem aprovam skills
    if os.environ.get("CORUJA_AGENTE", "").strip().lower() != "lab":
        return
    for nome, schema, handler, emoji in (
        ("numeros_corujas", NUMEROS_SCHEMA, _numeros, "📊"),
        ("propor_skill", PROPOR_SCHEMA, _propor, "📝"),
        ("listar_propostas", LISTAR_SCHEMA, _listar, "📋"),
        ("ver_proposta", VER_SCHEMA, _ver, "🔎"),
        ("aprovar_proposta", APROVAR_SCHEMA, _aprovar, "✅"),
        ("rejeitar_proposta", REJEITAR_SCHEMA, _rejeitar, "⛔"),
    ):
        ctx.register_tool(name=nome, toolset=TOOLSET, schema=schema, handler=handler, emoji=emoji)


# ── Uso pelo host (aplicar-propostas.sh) ─────────────────────────────────────
# python3 __init__.py validar <pasta> <aprovadores>  → "agente nome" ou erro (saída 1)
# python3 __init__.py mostrar <pasta>                 → resumo + 20 primeiras linhas (sem controle)
# python3 __init__.py marcar <pasta> aplicada|removida
# python3 __init__.py removidas <raiz> <agente> <nome> → marca 'aplicada' daquele agente/nome como 'removida'


def _host(argv: list[str]) -> int:
    import sys

    def falha(msg: str) -> int:
        print(msg, file=sys.stderr)
        return 1

    if len(argv) < 2:
        return falha("uso: validar|mostrar|marcar|removidas ...")
    modo, pasta = argv[0], Path(argv[1])
    if modo == "removidas":
        if len(argv) != 4:
            return falha("uso: removidas <raiz> <agente> <nome>")
        agora = _agora().isoformat(timespec="seconds")
        for p in sorted(pasta.glob("*/proposta.json")):
            try:
                m = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if m.get("agente") == argv[2] and m.get("nome") == argv[3] and m.get("status") == "aplicada":
                m.update(status="removida", removida_em=agora)
                _gravar_json(p, m)
                print(p)
        return 0
    try:
        meta = json.loads((pasta / "proposta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return falha(f"{pasta.name}: proposta.json ilegível ({type(e).__name__})")
    if modo == "validar":
        aprov = {x for x in re.split(r"[,\s]+", argv[2] if len(argv) > 2 else "") if x}
        erros = []
        if meta.get("status") != "aprovada":
            erros.append(f"status {meta.get('status')} (precisa ser aprovada)")
        if meta.get("id") != pasta.name or not RX_ID.match(pasta.name):
            erros.append("id da proposta diferente do nome da pasta")
        nome = str(meta.get("nome") or "")
        if not pasta.name.endswith("-" + nome):
            erros.append("nome da proposta diferente do da pasta")
        extras = sorted(x.name for x in pasta.iterdir() if x.name not in ("SKILL.md", "proposta.json"))
        if extras:
            erros.append(f"pasta tem arquivos além de SKILL.md: {', '.join(extras)}")
        if (pasta / "SKILL.md").is_symlink() or not (pasta / "SKILL.md").is_file():
            erros.append("SKILL.md ausente ou não é arquivo comum")
        else:
            erros += validar_skill_arquivo(pasta / "SKILL.md", str(meta.get("agente") or ""), nome)
            if meta.get("sha256") != _sha256(pasta / "SKILL.md"):
                erros.append("SKILL.md mudou depois da aprovação (sha256 não confere)")
        if not aprov:
            erros.append("lista de aprovadores vazia no host")
        elif str(meta.get("aprovada_por") or "") not in aprov:
            erros.append("aprovada_por não está na lista de aprovadores do host")
        if erros:
            return falha(f"{pasta.name}: " + "; ".join(erros))
        print(f"{meta['agente']} {nome}")
        return 0
    if modo == "mostrar":
        limpa = lambda t: CONTROLE.sub("?", str(t))  # noqa: E731 — sem sequência de escape no terminal
        print(f"  id:          {limpa(meta.get('id'))}")
        print(f"  agente:      {limpa(meta.get('agente'))}")
        print(f"  nome:        {limpa(meta.get('nome'))}")
        print(f"  descrição:   {limpa(meta.get('descricao'))}")
        print(f"  motivo:      {limpa(meta.get('motivo'))}")
        print(f"  aprovada:    {limpa(meta.get('aprovada_em'))} por {limpa(meta.get('aprovada_por'))}")
        print("  --- SKILL.md (20 primeiras linhas) ---")
        linhas = (pasta / "SKILL.md").read_text(encoding="utf-8", errors="replace").splitlines()
        for linha in linhas[:20]:
            print("  | " + limpa(linha))
        if len(linhas) > 20:
            print(f"  | ... (+{len(linhas) - 20} linhas)")
        return 0
    if modo == "marcar":
        novo = argv[2] if len(argv) > 2 else ""
        if novo != "aplicada":
            return falha("marcar: só 'aplicada'")
        meta.update(status="aplicada", aplicada_em=_agora().isoformat(timespec="seconds"))
        _gravar_json(pasta / "proposta.json", meta)
        return 0
    return falha(f"modo desconhecido: {modo}")


if __name__ == "__main__":
    import sys

    sys.exit(_host(sys.argv[1:]))
