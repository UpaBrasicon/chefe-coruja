"""Falcão (Argos) — porte de hermes/src/jobs/argos.ts: coerência dos dados
clínicos, 2x/dia. Sem LLM.

  A. observação com aferição no futuro
  B. prescrição com criação no futuro
  C. prescrição sem paciente (órfã)
  D. leito ocupado em setor sem ninguém de plantão agora (janela real, no banco)

⚠️ LGPD: só IDs e números, NUNCA nome de paciente.
"""

from __future__ import annotations

from .banco import ErroBanco
from .comum import iso_js
from .iris import registrar_incidentes


def chave_dedup(a: dict) -> str:
    """patrulha + título + id da evidência (observacao_id, prescricao_id ou setor_id)."""
    ev = a["evidencia"]
    id_ = next((ev[k] for k in ("observacao_id", "prescricao_id", "setor_id") if ev.get(k) is not None), None)
    return f"dados:[Falcao] {a['titulo']}:{'sem-id' if id_ is None else str(id_)}"


def _exigir(funcao, contexto: str):
    try:
        r = funcao()
    except ErroBanco as e:
        raise RuntimeError(f"[argos] {contexto}: {e}") from None
    return [] if r is None else r


def auditoria_argos(ctx) -> list[dict]:
    achados = []
    agora = iso_js(ctx.agora())
    for o in _exigir(lambda: ctx.banco.ler("observacoes_futuras", agora, 500), "observação"):
        achados.append({"severidade": "atencao", "titulo": "Observação com aferição no futuro",
                        "evidencia": {"observacao_id": o["id"], "unidade_id": o["unidade_id"], "aferido_em": o["aferido_em"]}})
    for p in _exigir(lambda: ctx.banco.ler("prescricoes_futuras", agora, 500), "prescrição futura"):
        achados.append({"severidade": "atencao", "titulo": "Prescrição com criação no futuro",
                        "evidencia": {"prescricao_id": p["id"], "unidade_id": p["unidade_id"], "created_at": p["created_at"]}})
    for p in _exigir(lambda: ctx.banco.ler("prescricoes_orfas", 500), "prescrição órfã"):
        achados.append({"severidade": "informativo", "titulo": "Prescrição sem paciente vinculado",
                        "evidencia": {"prescricao_id": p["id"], "unidade_id": p["unidade_id"]}})
    for x in _exigir(lambda: ctx.banco.rpc("hermes_setores_ocupados_sem_plantao"), "setor sem plantão"):
        achados.append({"severidade": "atencao", "titulo": "Leito ocupado em setor sem ninguém de plantão agora",
                        "evidencia": {"setor_id": x["setor_id"], "unidade_id": x["unidade_id"], "leitos_ocupados": x["leitos_ocupados"]}})
    return achados


def rodar_auditoria_argos(ctx) -> dict:
    achados = auditoria_argos(ctx)
    if not achados:
        return {"achados": 0, "novos": 0}
    novos = registrar_incidentes(
        ctx, achados, chave_dedup,
        lambda a: {"patrulha": "dados", "severidade": a["severidade"], "titulo": f"[Falcao] {a['titulo']}",
                   "evidencia": a["evidencia"], "chave_dedup": chave_dedup(a)},
        falha_lanca=True, contexto="argos",
    )
    return {"achados": len(achados), "novos": novos}
