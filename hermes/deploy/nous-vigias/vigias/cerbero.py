"""Cérbero — porte de hermes/src/jobs/cerbero.ts. Sem LLM na detecção.

- Patrulha A (dados, de hora em hora): cadastro e escala, contas no banco
  (hermes_* functions) + censo negativo dos últimos 7 dias;
- Patrulha C (hermes, diária 05h BR): prompt injection e volume anômalo no
  log do Hermes (últimas 24 h).
Dedup por chave ``patrulha:título:objeto``. Erro de consulta derruba a patrulha.

⚠️ Reporta IDs e números, NUNCA nome de paciente.
"""

from __future__ import annotations

import datetime as _dt

from .banco import ErroBanco
from .comum import iso_js, js_num
from .iris import registrar_incidentes
from .padroes import PADROES_INJECTION, algum


def chave_dedup(i: dict) -> str:
    return f"{i['patrulha']}:{i['titulo']}:{i['objeto']}"


def _exigir(funcao, contexto: str):
    try:
        r = funcao()
    except ErroBanco as e:
        raise RuntimeError(f"[cerbero] {contexto}: {e}") from None
    return [] if r is None else r


def _registrar(ctx, achados: list[dict]) -> int:
    return registrar_incidentes(
        ctx, achados, chave_dedup,
        lambda i: {"patrulha": i["patrulha"], "severidade": i["severidade"], "titulo": i["titulo"],
                   "evidencia": i["evidencia"], "chave_dedup": chave_dedup(i)},
        falha_lanca=True, contexto="cerbero",
    )


def patrulha_dados(ctx) -> list[dict]:
    achados = []
    # A1. Mesma pessoa em duas unidades ao mesmo tempo (±24 h)
    for s in _exigir(lambda: ctx.banco.rpc("hermes_plantoes_sobrepostos", {"p_horas": 24}), "sobrepostos"):
        achados.append({
            "patrulha": "dados", "severidade": "critico", "titulo": "Plantão em duas unidades ao mesmo tempo",
            "evidencia": s, "objeto": f"{s['perfil_id']}:{s['inicio_a']}:{s['inicio_b']}",
        })
    # A2. Perfil ativo sem vínculo ativo
    for p in _exigir(lambda: ctx.banco.rpc("hermes_perfis_sem_vinculo"), "sem vínculo"):
        achados.append({
            "patrulha": "dados", "severidade": "informativo", "titulo": "Usuário ativo sem papel atribuído",
            "evidencia": {"perfil_id": p["perfil_id"]}, "objeto": p["perfil_id"],
        })
    # A3. Mesmo CRM em perfis diferentes
    for c in _exigir(lambda: ctx.banco.rpc("hermes_crm_duplicado"), "crm"):
        crm = f"{c['crm']}/{c['uf_crm']}"
        achados.append({
            "patrulha": "dados", "severidade": "atencao", "titulo": "CRM duplicado entre médicos",
            "evidencia": {"crm": crm, "perfis": c["perfis"]}, "objeto": crm,
        })
    # A4. Censo com contagem negativa (últimos 7 dias)
    desde = ctx.hoje(-7)
    for c in _exigir(lambda: ctx.banco.ler("censos_negativos", desde), "censo"):
        campos = {k: c[k] for k in ("internados", "leitos_total", "leitos_ocupados", "leitos_livres")}
        negativos = [(k, v) for k, v in campos.items() if v is not None and v < 0]
        achados.append({
            "patrulha": "dados", "severidade": "atencao", "titulo": "Censo com contagem negativa",
            "evidencia": {"unidade_id": c["unidade_id"], "setor_id": c["setor_id"], "data": c["data"], "turno": c["turno"],
                          "campos_negativos": [f"{k}={js_num(v)}" for k, v in negativos]},
            "objeto": f"{c['setor_id']}:{c['data']}:{c['turno']}",
        })
    return achados


def patrulha_hermes(ctx) -> list[dict]:
    achados = []
    desde = iso_js(ctx.agora() - _dt.timedelta(hours=24))
    msgs = _exigir(lambda: ctx.banco.ler("entradas_audit_desde", desde, 1000), "audit log")

    por_telefone: dict = {}
    for m in msgs:
        corpo = m.get("tool_result_summary") or ""
        if algum(PADROES_INJECTION, corpo):
            achados.append({
                "patrulha": "hermes", "severidade": "atencao", "titulo": "Possível prompt injection no Hermes",
                # só o id da mensagem: o texto fica no log de origem, não é copiado
                "evidencia": {"audit_id": m["id"], "phone": m["phone"], "quando": m["created_at"]},
                "objeto": m["id"],
            })
        por_telefone[m["phone"]] = por_telefone.get(m["phone"], 0) + 1

    # Volume anômalo: bem acima da mediana
    contagens = sorted(por_telefone.values())
    if len(contagens) >= 10:
        mediana = contagens[len(contagens) // 2]
        maximo = contagens[-1]
        if mediana > 0 and maximo > mediana * 5:
            quem = next((k for k, v in por_telefone.items() if v == maximo), "?")
            achados.append({
                "patrulha": "hermes", "severidade": "atencao", "titulo": "Volume anômalo de mensagens ao Hermes",
                "evidencia": {"phone": quem, "quantidade": maximo, "mediana": mediana},
                "objeto": f"{quem}:{desde[:10]}",
            })
    return achados


def rodar_patrulha_dados(ctx) -> dict:
    achados = patrulha_dados(ctx)
    novos = _registrar(ctx, achados)
    return {"achados": len(achados), "novos": novos}


def rodar_patrulha_hermes(ctx) -> dict:
    achados = patrulha_hermes(ctx)
    novos = _registrar(ctx, achados)
    return {"achados": len(achados), "novos": novos}
