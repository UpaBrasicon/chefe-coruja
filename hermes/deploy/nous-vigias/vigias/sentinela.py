"""Sentinela de Escala — porte de hermes/src/jobs/sentinela.ts + agent/sentinela.ts.

Semanal (segunda 06h30 BR). Sem LLM: o "resumo factual" do TS já é montado
por código (linhas com números), não há chamada a modelo para portar.

1. Para cada unidade: as 5 métricas por médico (30d e 90d);
2. outliers por IQR da unidade (mínimo 8 plantões);
3. alerta novo em chronos_alertas_escala (sem duplicar novo/visto do mesmo
   médico+métrica+janela);
4. se houve alerta novo: notificação aos gestores pela Íris.
"""

from __future__ import annotations

import datetime as _dt
import math

from .banco import ErroBanco
from .comum import iso_js, js_num, js_round, log, ms_epoch
from .iris import dispatch_iris_para_gestores, gestores_da_unidade

MIN_PLANTOES = 8  # evita falso positivo de quem tem poucos plantões

CHAVES = ["repasses", "faltas", "cancelamento_tardio", "trocas_iniciadas", "concentracao_destino"]
NOMES = {
    "repasses": "taxa_repasse", "faltas": "faltas", "cancelamento_tardio": "cancelamento_tardio",
    "trocas_iniciadas": "trocas_iniciadas", "concentracao_destino": "concentracao_destino",
}
ROTULO = {
    "taxa_repasse": "repasses", "faltas": "faltas", "cancelamento_tardio": "repasses com <48h",
    "trocas_iniciadas": "trocas iniciadas", "concentracao_destino": "concentração de destino",
}


def quartil(ordenados: list, q: float) -> float:
    if not ordenados:
        return 0
    pos = (len(ordenados) - 1) * q
    base = math.floor(pos)
    resto = pos - base
    v0 = ordenados[base]
    v1 = ordenados[base + 1] if base + 1 < len(ordenados) else ordenados[base]
    return v0 + (v1 - v0) * resto


def calcular_limite_outlier(valores: list) -> tuple[float, float]:
    """(mediana, limite Q3 + 1,5·IQR). Menos de 2 valores: limite infinito."""
    if len(valores) < 2:
        return (valores[0] if valores else 0, math.inf)
    s = sorted(valores)
    q1 = quartil(s, 0.25)
    q3 = quartil(s, 0.75)
    return (quartil(s, 0.5), q3 + 1.5 * (q3 - q1))


def calcular_metricas_unidade(ctx, unidade_id: str, janela: str) -> list[dict]:
    dias = 30 if janela == "30d" else 90
    try:
        escala = ctx.banco.ler("escala_da_unidade", unidade_id, ctx.hoje(-dias), ctx.hoje())
    except ErroBanco as e:
        log.error("[sentinela] falha ao buscar escala: %s", e)
        raise RuntimeError("falha interna ao calcular métricas") from None
    plantoes: dict[str, list] = {}
    for p in escala:
        if not p.get("perfil_id"):
            continue
        plantoes.setdefault(p["perfil_id"], []).append(p)

    desde_iso = iso_js(ctx.agora() - _dt.timedelta(days=dias))
    try:
        sols = ctx.banco.ler("solicitacoes_da_unidade", unidade_id, desde_iso)
    except ErroBanco as e:
        log.error("[sentinela] falha ao buscar solicitações: %s", e)
        raise RuntimeError("falha interna ao calcular métricas") from None
    try:
        trocas = ctx.banco.ler("trocas_da_unidade", unidade_id, desde_iso)
    except ErroBanco as e:
        log.error("[sentinela] falha ao buscar trocas: %s", e)
        raise RuntimeError("falha interna ao calcular métricas") from None

    # mesma ordem do Set do TS: plantões, depois solicitações, depois trocas
    medicos: dict[str, None] = dict.fromkeys(plantoes)
    for s in sols:
        if s.get("perfil_id"):
            medicos.setdefault(s["perfil_id"], None)
    for t in trocas:
        if t.get("perfil_a_id"):
            medicos.setdefault(t["perfil_a_id"], None)

    resultado = []
    for medico in medicos:
        meus = [s for s in sols if s.get("perfil_id") == medico]
        repasses = [s for s in meus if s.get("tipo") == "passar_plantao" and s.get("status") == "aprovado"]
        faltas = [s for s in meus if s.get("tipo") == "falta"]
        minhas_trocas = [t for t in trocas if t.get("perfil_a_id") == medico and t.get("status") != "erro"]

        # cancelamento tardio: repasse cujo plantão é < 48h após a solicitação
        tardio = 0
        for r in repasses:
            data_plantao = (r.get("escala_plantao") or {}).get("data")
            if not data_plantao:
                continue
            plantao_ms = ms_epoch(f"{data_plantao}T23:59:59")
            criado_ms = ms_epoch(r.get("created_at"))
            if plantao_ms is not None and criado_ms is not None and plantao_ms - criado_ms < 48 * 3_600_000:
                tardio += 1

        # concentração de destino: % indo para o destino mais frequente
        concentracao = 0
        if repasses:
            contagem: dict[str, int] = {}
            for r in repasses:
                if r.get("destino_perfil_id"):
                    contagem[r["destino_perfil_id"]] = contagem.get(r["destino_perfil_id"], 0) + 1
            concentracao = max([0, *contagem.values()]) / len(repasses)

        resultado.append({
            "medico_id": medico,
            "plantoes_atribuidos": len(plantoes.get(medico, [])),
            "repasses": len(repasses),
            "faltas": len(faltas),
            "cancelamento_tardio": tardio,
            "trocas_iniciadas": len(minhas_trocas),
            "concentracao_destino": concentracao,
        })
    return resultado


def detectar_outliers(metricas: list[dict], janela: str) -> list[dict]:
    alertas = []
    for chave in CHAVES:
        elegiveis = [m for m in metricas if m["plantoes_atribuidos"] >= MIN_PLANTOES]
        if len(elegiveis) < 2:
            continue
        mediana, limite = calcular_limite_outlier([m[chave] for m in elegiveis])
        if not math.isfinite(limite):
            continue
        for m in elegiveis:
            if m[chave] > limite:
                alertas.append({
                    "unidade_id": "", "medico_id": m["medico_id"], "janela": janela, "metrica": NOMES[chave],
                    "valor": m[chave], "mediana_unidade": mediana, "limite_outlier": limite, "detalhe": {},
                })
    return alertas


def _inserir_alertas(ctx, unidade_id: str, alertas: list[dict]) -> int:
    inseridos = 0
    for a in alertas:
        try:
            existente = ctx.banco.ler("alerta_escala_aberto", unidade_id, a["medico_id"], a["janela"], a["metrica"])
        except ErroBanco:
            existente = []  # o TS ignora o erro e tenta inserir
        if existente:
            ctx.grava.anotar({
                "tabela": "chronos_alertas_escala", "acao": "ja_aberto", "unidade_id": unidade_id,
                "medico_id": a["medico_id"], "janela": a["janela"], "metrica": a["metrica"],
            })
            continue
        try:
            ctx.grava.inserir_alerta_escala({**a, "unidade_id": unidade_id})
        except ErroBanco as e:
            log.warning("[sentinela] falha ao inserir alerta (%s): %s", a["metrica"], e)
            continue
        inseridos += 1
    return inseridos


def resumo_factual(ctx, alertas: list[dict]) -> str:
    """Factual por construção (sem LLM) — "fatos, sem adjetivos"."""
    ids = list(dict.fromkeys(a["medico_id"] for a in alertas))
    try:
        perfis = ctx.banco.ler("nomes_de_perfis", ids) if ids else []
    except ErroBanco:
        perfis = []
    nomes = {}
    for p in perfis:
        nomes.setdefault(p["id"], p["nome_completo"])

    linhas = []
    for a in alertas:
        detalhe = (
            f" ({js_num(js_round(a['valor'] * 100))}% para o mesmo destino)" if a["metrica"] == "concentracao_destino" else ""
        )
        nome = nomes.get(a["medico_id"])
        linhas.append(
            f"• {nome if nome is not None else 'médico'}: {js_num(a['valor'])} {ROTULO[a['metrica']]} em {a['janela']}"
            f" (mediana da unidade: {js_num(a['mediana_unidade'])}){detalhe}"
        )
    return "\n".join(linhas)


def _notificar_gestores(ctx, unidade_id: str, unidade_nome: str, alertas: list[dict]) -> None:
    if not gestores_da_unidade(ctx, unidade_id):
        return
    texto = f"📊 Sentinela de Escala — Unidade {unidade_nome} — semana {ctx.hoje()}\n\n{resumo_factual(ctx, alertas)}"
    dispatch_iris_para_gestores(ctx, unidade_id, "sentinela_escala", texto)


def rodar_sentinela(ctx) -> dict:
    try:
        unidades = ctx.banco.ler("unidades_ativas")
    except ErroBanco as e:
        log.error("[sentinela] falha ao listar unidades: %s", e)
        raise RuntimeError("falha ao listar unidades") from None

    novos = 0
    com_alerta = []
    for u in unidades:
        alertas = []
        for janela in ("30d", "90d"):
            for a in detectar_outliers(calcular_metricas_unidade(ctx, u["id"], janela), janela):
                a["unidade_id"] = u["id"]
                alertas.append(a)
        if not alertas:
            continue
        inseridos = _inserir_alertas(ctx, u["id"], alertas)
        novos += inseridos
        if inseridos > 0:
            com_alerta.append((u["id"], u["nome"], alertas))

    for unidade_id, nome, alertas in com_alerta:
        _notificar_gestores(ctx, unidade_id, nome, alertas)
    return {"unidades": len(unidades), "alertas_novos": novos}
