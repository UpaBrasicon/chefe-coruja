"""Relatório semanal do Gavião — porte de hermes/src/jobs/relatorio.ts.

Agrega os incidentes do Cérbero e os alertas do Sentinela dos últimos 7 dias e
grava em gaviao_relatorios_semanais (id gerado aqui: hermes_job não tem SELECT
na tabela). Só números e títulos — nunca dado de paciente.
"""

from __future__ import annotations

import datetime as _dt

from .banco import ErroBanco
from .comum import iso_js, log


def montar_resumo(incidentes: list[dict], alertas: list[dict], inicio_iso: str, fim_iso: str) -> dict:
    """Agregação PURA (mesma ordem de chaves do TS)."""
    def conta(lista, campo, valor):
        return sum(1 for x in lista if x.get(campo) == valor)

    return {
        "incidentes_por_severidade": {s: conta(incidentes, "severidade", s) for s in ("critico", "atencao", "informativo")},
        "incidentes_por_patrulha": {p: conta(incidentes, "patrulha", p) for p in ("dados", "conteudo", "hermes")},
        "alertas_por_status": {s: conta(alertas, "status", s) for s in ("novo", "visto", "em_acompanhamento", "justificado")},
        "total_incidentes": len(incidentes),
        "total_alertas": len(alertas),
        "periodo": {"inicio": inicio_iso[:10], "fim": fim_iso[:10]},
    }


def gerar_relatorio_semanal(ctx) -> dict:
    fim = ctx.agora()
    inicio = fim - _dt.timedelta(days=7)
    inicio_iso, fim_iso = iso_js(inicio), iso_js(fim)

    try:
        incidentes = ctx.banco.ler("incidentes_no_periodo", inicio_iso, fim_iso)
    except ErroBanco as e:
        log.error("[relatorio] falha ao buscar incidentes: %s", e)
        raise RuntimeError("falha ao gerar relatório") from None
    try:
        alertas = ctx.banco.ler("alertas_no_periodo", inicio_iso, fim_iso)
    except ErroBanco as e:
        log.error("[relatorio] falha ao buscar alertas: %s", e)
        raise RuntimeError("falha ao gerar relatório") from None

    lista_incidentes = [
        {"id": i["id"], "patrulha": i["patrulha"], "severidade": i["severidade"], "titulo": i["titulo"],
         "status": i["status"], "quando": i["detectado_em"]}
        for i in incidentes
    ]
    lista_alertas = [
        {"id": a["id"], "unidade_id": a["unidade_id"], "metrica": a["metrica"], "valor": a["valor"],
         "status": a["status"], "quando": a["criado_em"]}
        for a in alertas
    ]
    resumo = montar_resumo(lista_incidentes, lista_alertas, inicio_iso, fim_iso)
    try:
        id_ = ctx.grava.inserir_relatorio({
            "periodo_inicio": inicio_iso[:10],
            "periodo_fim": fim_iso[:10],
            "resumo": resumo,
            "detalhes": {"incidentes": lista_incidentes, "alertas": lista_alertas},
        })
    except ErroBanco as e:
        log.error("[relatorio] falha ao gravar relatório: %s", e)
        raise RuntimeError("falha ao gravar relatório") from None
    return {"id": id_, "incidentes": len(lista_incidentes), "alertas": len(lista_alertas)}
