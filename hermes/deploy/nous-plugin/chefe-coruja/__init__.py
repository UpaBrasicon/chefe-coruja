"""Plugin do Chefe Coruja para o Hermes Agent (Nous) — rodada A, 27/09/2026.

Substitui as skills por script shell. Duas diferenças que importam:

1. **Quem pergunta vem da sessão do canal.** O gateway do Nous preenche
   ``HERMES_SESSION_PLATFORM``/``HERMES_SESSION_USER_ID`` a partir da mensagem
   recebida. O handler lê direto da sessão (ContextVar), dentro do processo —
   o modelo só escolhe O QUE consultar, nunca QUEM é. Com o shell, o modelo
   podia montar o comando e trocar a identidade.
2. **Sem terminal.** O bot não precisa mais de shell para falar com o
   backend, então o terminal sai do conjunto de ferramentas do Telegram.

O backend (hermes-app, rede interna) resolve o perfil pelo vínculo criado com
código de uso único, aplica papel e unidade no servidor e devolve só dado
agregado (sem nome de colega, sem dado de paciente).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from gateway.session_context import get_session_env

TOOLSET = "chefe-coruja"

# escopo → comandos aceitos (a guarda de papel é do servidor)
COMANDOS = {
    "escala": ["meus_plantoes", "plantao_do_dia"],
    "operacional": ["setores", "censo", "indicadores", "profissionais", "notificacoes"],
    "aguia": ["resumo", "setores", "censo", "indicadores", "profissionais"],
    "garca": ["indicadores", "censo", "internacoes"],
    "sentinela": ["alertas", "relatorio"],
    "seguranca": ["incidentes", "quarentena"],
    "infra": ["integridade"],
}

CONSULTAR_SCHEMA = {
    "name": "coruja_consultar",
    "description": (
        "Consulta dados REAIS do Chefe Coruja em nome de quem está conversando (identificado pela sessão; "
        "não informe usuário). Escopos e comandos: "
        "escala: meus_plantoes (periodo hoje|semana|mes), plantao_do_dia (gestor; data AAAA-MM-DD); "
        "operacional: setores, censo, indicadores, profissionais (contagem por papel), notificacoes (dias 1-90); "
        "aguia: resumo da unidade; garca: indicadores, censo, internacoes (contagem por status); "
        "sentinela: alertas, relatorio (gestor/admin); seguranca: incidentes, quarentena (suporte); "
        "infra: integridade (suporte). Se a resposta disser que a conta não está vinculada, peça o código "
        "de 6 dígitos do Perfil e use coruja_vincular."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "escopo": {"type": "string", "enum": list(COMANDOS)},
            "comando": {"type": "string"},
            "periodo": {"type": "string", "enum": ["hoje", "semana", "mes"]},
            "data": {"type": "string", "description": "AAAA-MM-DD"},
            "dias": {"type": "integer"},
            "status": {"type": "string"},
            "patrulha": {"type": "string"},
            "severidade": {"type": "string"},
        },
        "required": ["escopo", "comando"],
    },
}

VINCULAR_SCHEMA = {
    "name": "coruja_vincular",
    "description": (
        "Liga esta conta do Telegram ao perfil da pessoa no Chefe Coruja, com o código de 6 dígitos que ela "
        "gerou em Perfil → Conectar ao Telegram (vale 10 minutos, uso único)."
    ),
    "parameters": {
        "type": "object",
        "properties": {"codigo": {"type": "string", "description": "6 dígitos"}},
        "required": ["codigo"],
    },
}


ALMANAQUE_SCHEMA = {
    "name": "coruja_almanaque",
    "description": (
        "USE PRIMEIRO para dúvidas de COMO USAR o Chefe Coruja (check-in, turnos, sem internet, triagem, "
        "prioridade legal, chamada, painel da TV, cadastro, impressão, Telegram, segundo fator, desfechos). "
        "Devolve respostas prontas e aprovadas: se vier uma, responda com ela, sem reescrever."
    ),
    "parameters": {
        "type": "object",
        "properties": {"pergunta": {"type": "string", "description": "a dúvida, nas palavras da pessoa"}},
        "required": ["pergunta"],
    },
}


def _almanaque(args: dict, **_kw) -> str:
    pergunta = str(args.get("pergunta") or "").strip()[:300]
    if len(pergunta) < 3:
        return json.dumps({"ok": False, "erro": "informe a pergunta"}, ensure_ascii=False)
    r = _post("/skill/consulta", {"escopo": "almanaque", "comando": "buscar", "args": {"texto": pergunta}})
    if r.get("ok") and not r.get("dados"):
        r["dica"] = "Nada no almanaque: se for sobre dados, use coruja_consultar; se estiver fora do escopo, recuse."
    return json.dumps(r, ensure_ascii=False)


def _sujeito() -> dict | None:
    """Identidade da SESSÃO (preenchida pelo gateway), nunca de argumento."""
    plataforma = get_session_env("HERMES_SESSION_PLATFORM", "")
    usuario = get_session_env("HERMES_SESSION_USER_ID", "")
    if plataforma == "telegram" and usuario:
        return {"canal": "telegram", "identificador": str(usuario)}
    return None


def _post(caminho: str, corpo: dict) -> dict:
    url = os.environ["HERMES_BACKEND_URL"].rstrip("/") + caminho
    req = urllib.request.Request(
        url,
        data=json.dumps(corpo).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Skill-Token": os.environ["HERMES_SKILL_TOKEN"]},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return json.load(e)
        except Exception:  # noqa: BLE001 — corpo não-JSON
            return {"ok": False, "erro": f"http {e.code}"}
    except Exception as e:  # noqa: BLE001 — rede/timeout
        return {"ok": False, "erro": f"backend indisponível ({type(e).__name__})"}


def _consultar(args: dict, **_kw) -> str:
    sujeito = _sujeito()
    if not sujeito:
        return json.dumps({"ok": False, "erro": "Consulta disponível só pelo Telegram."}, ensure_ascii=False)
    escopo = str(args.get("escopo") or "")
    comando = str(args.get("comando") or "")
    if comando not in COMANDOS.get(escopo, []):
        return json.dumps({"ok": False, "erro": f"comando inválido para {escopo}"}, ensure_ascii=False)
    extras = {k: args[k] for k in ("periodo", "data", "dias", "status", "patrulha", "severidade") if args.get(k) is not None}
    r = _post("/skill/consulta", {**sujeito, "escopo": escopo, "comando": comando, "args": extras})
    if r.get("erro") == "nao_autorizado":
        r["dica"] = (
            "Se a pessoa ainda não ligou o Telegram à conta: Perfil → Conectar ao Telegram gera um código; "
            "peça o código e use coruja_vincular."
        )
    return json.dumps(r, ensure_ascii=False)


def _vincular(args: dict, **_kw) -> str:
    sujeito = _sujeito()
    if not sujeito:
        return json.dumps({"ok": False, "erro": "Vínculo disponível só pelo Telegram."}, ensure_ascii=False)
    codigo = "".join(ch for ch in str(args.get("codigo") or "") if ch.isdigit())
    return json.dumps(_post("/skill/vincular", {**sujeito, "codigo": codigo}), ensure_ascii=False)


# ── Biblioteca clínica (busca inteligente da Central, 28/09/2026) ─────────────
# Mesma API "biblioteca" que a barra da Central usa (VPS, rede interna
# deploy_default: http://biblioteca-api:8710). Devolve só referências
# (título/seção/página) e prévias curtas — o conteúdo dos trechos não vai para
# a memória persistente do Hermes. Uso pelos agentes de gestor e auditoria;
# o chat do plantonista não passa por aqui.

BIBLIOTECA_SCHEMA = {
    "name": "biblioteca_clinica_buscar",
    "description": (
        "Busca trechos citáveis nas fontes clínicas licenciadas/abertas (Ministério da Saúde) e nas "
        "ferramentas da Central do Plantonista. Devolve ferramentas sugeridas (nome, rota) e trechos com "
        "título, seção e página. Não calcula dose nem escore: aponte a ferramenta da Central."
    ),
    "parameters": {
        "type": "object",
        "properties": {"pergunta": {"type": "string", "description": "dúvida clínica, sem dados de paciente"}},
        "required": ["pergunta"],
    },
}


def _biblioteca_buscar(args: dict, **_kw) -> str:
    import uuid

    pergunta = str(args.get("pergunta") or "").strip()[:800]
    if len(pergunta) < 3:
        return json.dumps({"ok": False, "erro": "informe a pergunta"}, ensure_ascii=False)
    url = os.environ.get("BIBLIOTECA_URL", "http://biblioteca-api:8710").rstrip("/") + "/v1/search"
    req = urllib.request.Request(
        url,
        data=json.dumps({"q": pergunta, "tenant_id": "global", "request_id": f"hermes-{uuid.uuid4()}"}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["BIBLIOTECA_API_KEY"]},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            dados = json.load(r)
    except Exception as e:  # noqa: BLE001 — rede/timeout/http
        return json.dumps({"ok": False, "erro": f"biblioteca indisponível ({type(e).__name__})"}, ensure_ascii=False)
    trechos = [
        {"n": t["n"], "titulo": t["titulo"], "editor": t["editor"], "ano": t["ano"], "secao": t.get("secao"),
         "pagina": t.get("pagina"), "ref": t.get("ref"), "preview": (t.get("preview") or "")[:200]}
        for t in dados.get("trechos", [])
    ]
    return json.dumps({"ok": True, "ferramentas": dados.get("ferramentas", []), "trechos": trechos,
                       "aviso": "Suporte à decisão baseado nas fontes citadas. A conduta é do médico assistente."},
                      ensure_ascii=False)


def _biblioteca_disponivel() -> bool:
    return bool(os.environ.get("BIBLIOTECA_API_KEY"))


def _disponivel() -> bool:
    return bool(os.environ.get("HERMES_BACKEND_URL") and os.environ.get("HERMES_SKILL_TOKEN"))


def register(ctx) -> None:
    ctx.register_tool(name="coruja_consultar", toolset=TOOLSET, schema=CONSULTAR_SCHEMA,
                      handler=_consultar, check_fn=_disponivel, emoji="🦉")
    ctx.register_tool(name="coruja_almanaque", toolset=TOOLSET, schema=ALMANAQUE_SCHEMA,
                      handler=_almanaque, check_fn=_disponivel, emoji="📖")
    ctx.register_tool(name="coruja_vincular", toolset=TOOLSET, schema=VINCULAR_SCHEMA,
                      handler=_vincular, check_fn=_disponivel, emoji="🔗")
    ctx.register_tool(name="biblioteca_clinica_buscar", toolset=TOOLSET, schema=BIBLIOTECA_SCHEMA,
                      handler=_biblioteca_buscar, check_fn=_biblioteca_disponivel, emoji="📚")
