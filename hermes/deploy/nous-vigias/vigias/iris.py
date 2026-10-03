"""Dedup de incidentes (jobs/dedup.ts) e Íris/Andorinha (jobs/iris.ts).

Íris: notificações SEMPRE por aqui (nunca envio direto) — entrega dentro do
app (notificacoes_plantonista). Uma por tipo por pessoa por dia: o índice
UNIQUE (perfil_id, unidade_id, data, tipo) recusa a repetida, e isso volta
como ``ok=False`` (aviso no log), igual ao TS.
"""

from __future__ import annotations

from .banco import ErroBanco
from .comum import js_slice, log, sha256

TAMANHO_LOTE = 100


def filtrar_novos(itens: list, chave, abertas: set[str]) -> list:
    """Itens cuja chave de dedup NÃO está aberta (pura)."""
    return [i for i in itens if chave(i) not in abertas]


def chaves_ja_abertas(ctx, chaves: list[str]) -> set[str]:
    """Chaves que já têm incidente aberto/em análise, em lotes de 100. Erro no
    pre-check: aviso e segue como "nenhuma existente" (o insert seguinte falha
    junto se o banco estiver fora) — igual ao TS."""
    encontradas: set[str] = set()
    for i in range(0, len(chaves), TAMANHO_LOTE):
        fatia = chaves[i: i + TAMANHO_LOTE]
        try:
            linhas = ctx.banco.ler("chaves_incidentes_abertos", fatia)
        except ErroBanco as e:
            log.warning("[dedup] pre-check falhou — tratando como sem existentes: %s", e)
            continue
        for r in linhas:
            if r.get("chave_dedup"):
                encontradas.add(r["chave_dedup"])
    return encontradas


def registrar_incidentes(ctx, itens: list, chave, montar, *, falha_lanca: bool, contexto: str) -> int:
    """Pre-check + filtro + insert, o fluxo comum de Cérbero, Falcão, Gavião e
    vigias. Na sombra, as chaves que já estavam abertas também vão ao registro
    (para a comparação saber que o Nous "viu" o mesmo incidente)."""
    if not itens:
        return 0
    abertas = chaves_ja_abertas(ctx, [chave(i) for i in itens])
    for i in itens:
        if chave(i) in abertas:
            ctx.grava.anotar({"tabela": "cerbero_incidentes", "acao": "ja_aberta", "chave_sha256": sha256(chave(i))})
    novos = filtrar_novos(itens, chave, abertas)
    if not novos:
        return 0
    try:
        ctx.grava.inserir_incidentes([montar(i) for i in novos])
    except ErroBanco as e:
        if falha_lanca:
            raise RuntimeError(f"[{contexto}] falha ao registrar incidentes: {e}") from None
        log.warning("[%s] falha ao registrar incidente: %s", contexto, e)
    return len(novos)


def dispatch_iris(ctx, perfil_id: str, unidade_id: str | None, tipo: str, mensagem: str, data: str | None = None) -> dict:
    try:
        id_ = ctx.grava.inserir_notificacao({
            "perfil_id": perfil_id,
            "unidade_id": unidade_id,
            "tipo": tipo,
            "mensagem": js_slice(mensagem, 500),
            "data": data or ctx.hoje(),
        })
    except ErroBanco as e:
        log.warning("[iris] falha ao notificar (%s): %s", tipo, e)
        return {"ok": False, "erro": str(e)}
    log.info("[iris] notificação enviada (%s)", tipo)
    return {"ok": True, "id": id_}


def gestores_da_unidade(ctx, unidade_id: str) -> list[dict]:
    """Gestores e admins ativos. Erro vira lista vazia (o TS ignora o erro)."""
    try:
        return ctx.banco.ler("gestores_da_unidade", unidade_id)
    except ErroBanco as e:
        log.warning("[iris] falha ao listar gestores: %s", e)
        return []


def dispatch_iris_para_gestores(ctx, unidade_id: str, tipo: str, mensagem: str) -> int:
    enviadas = 0
    for v in gestores_da_unidade(ctx, unidade_id):
        if dispatch_iris(ctx, v["perfil_id"], unidade_id, tipo, mensagem)["ok"]:
            enviadas += 1
    return enviadas
