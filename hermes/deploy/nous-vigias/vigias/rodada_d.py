"""Os seis vigias da rodada D (27/09) — porte de hermes/src/jobs/vigias.ts.

Sem LLM: a conta roda no banco (hermes_* functions) e aqui só se decide QUEM
recebe. Só números e IDs. Avisos pela Íris (uma por tipo por pessoa por dia;
o tipo leva a hora quando precisa de mais de uma).

  Porta ............. resumo da virada de plantão para o gestor
  Presença .......... plantão começou e a pessoa não fez check-in
  Buraco na escala .. setor sem ninguém nas próximas 24 h, para o gestor
  Registros tardios . revisão parada há mais de 24 h, para o gestor
  Guardião .......... aberturas/impressões de prontuário fora do padrão
  Cadeia ............ log de auditoria adulterado
"""

from __future__ import annotations

from .banco import ErroBanco
from .comum import BRASILIA, js_num, log
from .iris import dispatch_iris, dispatch_iris_para_gestores, registrar_incidentes

NOME_COR = {"vermelho": "Vermelho", "laranja": "Laranja", "amarelo": "Amarelo", "verde": "Verde", "azul": "Azul"}


def _exigir(funcao, contexto: str):
    try:
        r = funcao()
    except ErroBanco as e:
        raise RuntimeError(f"[vigias] {contexto}: {e}") from None
    return [] if r is None else r


def _unidades(ctx) -> list[dict]:
    return _exigir(lambda: ctx.banco.ler("unidades_ativas"), "unidades")


def _js_verdadeiro(v) -> bool:
    """Truthiness do JS: {} e [] são verdadeiros; None, 0, '' e False não."""
    return not (v is None or v is False or v == 0 or v == "")


# ── Porta ────────────────────────────────────────────────────────────────────
def texto_porta(unidade: str, r: dict) -> str:
    por_cor = r["por_cor"]
    cores = [
        f"{NOME_COR[c]}: {js_num(por_cor[c]['dentro_do_alvo'])}/{js_num(por_cor[c]['atendidos'])} no tempo-alvo"
        f" (espera média {js_num(por_cor[c]['espera_media_min'])} min)"
        for c in ("vermelho", "laranja", "amarelo", "verde", "azul")
        if _js_verdadeiro(por_cor.get(c))
    ]
    return "\n".join([
        f"🦉 Porta — últimas {js_num(r['janela_horas'])} h · {unidade}",
        f"{js_num(r['fichas'])} fichas · {js_num(r['atendidos'])} atendidos · {js_num(r['evasoes'])} evasões"
        f" · {js_num(r['aguardando_agora'])} aguardando agora",
        *cores,
    ])


def vigia_porta(ctx) -> int:
    hora = f"{ctx.agora().astimezone(BRASILIA).hour:02d}"
    enviados = 0
    for u in _unidades(ctx):
        r = _exigir(lambda: ctx.banco.rpc("hermes_porta_resumo", {"p_unidade": u["id"], "p_horas": 12}), "porta")
        if not isinstance(r, dict):
            raise TypeError("porta: resposta sem resumo")  # no TS, r.por_cor indefinido também derruba
        if r.get("fichas") == 0 and r.get("aguardando_agora") == 0:
            continue
        enviados += dispatch_iris_para_gestores(ctx, u["id"], f"porta_resumo_{hora}h", texto_porta(u["nome"], r))
    return enviados


# ── Presença ─────────────────────────────────────────────────────────────────
def vigia_presenca(ctx) -> int:
    enviados = 0
    for p in _exigir(lambda: ctx.banco.rpc("hermes_checkin_pendente"), "check-in"):
        r = dispatch_iris(
            ctx, p["perfil_id"], p["unidade_id"],
            f"checkin_pendente_{p['inicio_brasilia'].replace(':', '', 1)}",
            f"Seu plantão em {p['setor']} começou às {p['inicio_brasilia']} e o check-in ainda não foi feito. Faça em Meu Plantão.",
        )
        if r["ok"]:
            enviados += 1
    return enviados


# ── Buraco na escala ─────────────────────────────────────────────────────────
def texto_escala(lista: list[dict]) -> str:
    linhas = [f"• {b['setor']}: {js_num(b['horas_sem_ninguem'])} h sem ninguém, a partir de {b['primeira_hora_brasilia']}"
              for b in lista[:6]]
    if len(lista) > 6:
        linhas.append(f"• … e mais {len(lista) - 6} setores")
    return "\n".join(["Escala das próximas 24 h com setor descoberto:", *linhas])


def vigia_escala(ctx) -> int:
    por_unidade: dict[str, list] = {}
    for b in _exigir(lambda: ctx.banco.rpc("hermes_buracos_escala", {"p_horas": 24}), "buracos"):
        por_unidade.setdefault(b["unidade_id"], []).append(b)
    enviados = 0
    for unidade_id, lista in por_unidade.items():
        enviados += dispatch_iris_para_gestores(ctx, unidade_id, "escala_buraco", texto_escala(lista))
    return enviados


# ── Registros tardios ────────────────────────────────────────────────────────
def vigia_tardios(ctx) -> int:
    enviados = 0
    for p in _exigir(lambda: ctx.banco.rpc("hermes_revisoes_paradas"), "tardios"):
        enviados += dispatch_iris_para_gestores(
            ctx, p["unidade_id"], "registros_tardios",
            f"{js_num(p['pendentes'])} registro(s) feitos sem conexão aguardam revisão há mais de 24 h"
            f" (o mais antigo chegou {p['mais_antiga_brasilia']}). Abra Unidade → Registros tardios.",
        )
    return enviados


# ── Incidentes (Guardião e Cadeia) ───────────────────────────────────────────
def _registrar(ctx, lista: list[dict]) -> int:
    return registrar_incidentes(
        ctx, lista, lambda i: i["chave"],
        lambda i: {"patrulha": "dados", "severidade": i["severidade"], "titulo": i["titulo"],
                   "evidencia": i["evidencia"], "chave_dedup": i["chave"]},
        falha_lanca=True, contexto="vigias",
    )


def guardiao_prontuario(ctx) -> int:
    achados = _exigir(
        lambda: ctx.banco.rpc("hermes_acessos_anomalos", {"p_horas": 24, "p_aberturas": 80, "p_impressoes": 40}), "acessos"
    )
    hoje = ctx.hoje()
    novos = _registrar(ctx, [
        {"severidade": "atencao", "titulo": "Acesso ao prontuário fora do padrão (24 h)", "evidencia": a,
         "chave": f"dados:guardiao:{a['perfil_id']}:{a['unidade_id']}:{hoje}"}
        for a in achados
    ])
    log.info("[vigias] guardião: %s achados, %s novos", len(achados), novos)
    return len(achados)


def cadeia_auditoria(ctx) -> bool:
    # Aqui NULL é a resposta boa (cadeia íntegra): não passa pelo _exigir(),
    # que troca None por lista vazia.
    try:
        quebra = ctx.banco.rpc("hermes_cadeia_auditoria")
    except ErroBanco as e:
        raise RuntimeError(f"[vigias] cadeia: {e}") from None
    if isinstance(quebra, (int, float)) and not isinstance(quebra, bool):
        _registrar(ctx, [{
            "severidade": "critico", "titulo": "Cadeia do log de auditoria adulterada",
            "evidencia": {"primeira_linha_invalida": quebra}, "chave": f"dados:cadeia:{js_num(quebra)}",
        }])
        log.error("[vigias] cadeia de auditoria QUEBRADA (seq %s)", quebra)
        return False
    return True
