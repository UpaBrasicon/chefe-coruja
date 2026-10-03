"""Gavião — porte de hermes/src/jobs/gaviao.ts (fiscal do agente do Nous).

Lê as conversas das últimas 24 h no state.db do Nous (SQLite, somente
leitura) e confere as regras de ouro:
  R1. resposta do agente com dado clínico de paciente (LGPD);
  R4. prompt injection do usuário / revelação de instruções internas;
  R5. volume anômalo de mensagens numa sessão.
Sem LLM. Incidentes com trecho MÍNIMO e IDs.

No Nous o state.db é o do próprio contêiner: $HERMES_HOME/state.db
(/opt/data/state.db). NOUS_DB_PATH sobrepõe, como no hermes-app.
"""

from __future__ import annotations

import os
import sqlite3
import time

from .comum import js_slice, log
from .iris import registrar_incidentes
from .padroes import (
    IDENTIFICADOR, PADROES_CLINICO, PADROES_INJECTION, PADROES_RECUSA, REVELACAO_1, REVELACAO_2,
    VALOR_DE_EXAME, algum, testa,
)


def caminho_state_db(ambiente) -> str:
    if ambiente.get("NOUS_DB_PATH"):
        return ambiente["NOUS_DB_PATH"]
    return os.path.join(ambiente.get("HERMES_HOME") or "/opt/data", "state.db")


def parece_dado_de_paciente(texto: str) -> bool:
    """R1 (auditoria 27/09): paciente nomeado, valor de exame ou termo clínico
    junto de identificador (CPF, nº de prontuário, leito, box)."""
    if testa(PADROES_CLINICO[1], texto):
        return True
    if testa(VALOR_DE_EXAME, texto):
        return True
    return testa(PADROES_CLINICO[0], texto) and testa(IDENTIFICADOR, texto)


def chave_dedup(a: dict) -> str:
    """patrulha + título + session_id (+ trecho, quando existe)."""
    ev = a["evidencia"]
    sessao = ev.get("session_id")
    sessao = "sem-sessao" if sessao is None else str(sessao)
    trecho = str(ev["trecho"]) if ev.get("trecho") else ""
    return f"hermes:[Gaviao] {a['titulo']}:{sessao}:{trecho}"


def ler_mensagens_recentes(ctx, horas: int, agora_s: float | None = None) -> list[dict]:
    caminho = caminho_state_db(ctx.ambiente)
    if not os.path.exists(caminho):
        log.warning("[gaviao] state.db do Nous não encontrado: %s", caminho)
        return []
    desde = (time.time() if agora_s is None else agora_s) - horas * 3600
    try:
        db = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=10)
        try:
            # Só conversas com pessoas: sessões de job agendado (cron) ficam fora.
            linhas = db.execute(
                "SELECT m.session_id, m.role, m.content, m.timestamp"
                "  FROM messages m JOIN sessions s ON s.id = m.session_id"
                " WHERE m.timestamp >= ? AND m.content IS NOT NULL AND coalesce(s.source, '') <> 'cron'"
                " ORDER BY m.timestamp",
                (desde,),
            ).fetchall()
        finally:
            db.close()
    except sqlite3.Error as e:
        log.error("[gaviao] falha ao ler state.db: %s", e)
        return []
    return [
        {"session_id": s, "role": r, "content": c if isinstance(c, str) else str(c), "timestamp": t}
        for s, r, c, t in linhas
    ]


def analisar(msgs: list[dict]) -> list[dict]:
    """A parte pura da patrulha (testável sem state.db)."""
    achados = []
    usuarios = [m for m in msgs if m["role"] == "user"]
    for m in usuarios:  # R4a
        if algum(PADROES_INJECTION, m["content"]):
            achados.append({
                "regra": "R4", "severidade": "atencao", "titulo": "Tentativa de prompt injection no agente (Nous)",
                "evidencia": {"session_id": m["session_id"], "trecho": js_slice(m["content"], 120)},
            })
    assistentes = [m for m in msgs if m["role"] == "assistant"]
    for m in assistentes:  # R4b
        if testa(REVELACAO_1, m["content"]) and testa(REVELACAO_2, m["content"]):
            achados.append({
                "regra": "R4", "severidade": "atencao", "titulo": "Possível revelação de instruções internas pelo agente",
                "evidencia": {"session_id": m["session_id"], "trecho": js_slice(m["content"], 150)},
            })
    for m in assistentes:  # R1 — recusa é a regra sendo cumprida, não violação
        if algum(PADROES_RECUSA, js_slice(m["content"], 160)):
            continue
        if parece_dado_de_paciente(m["content"]):
            achados.append({
                "regra": "R1", "severidade": "critico", "titulo": "Resposta do agente com possível conteúdo clínico de paciente",
                "evidencia": {"session_id": m["session_id"], "trecho": js_slice(m["content"], 150)},
            })
    # R5 — volume anômalo por sessão
    por_sessao: dict = {}
    for m in usuarios:
        por_sessao[m["session_id"]] = por_sessao.get(m["session_id"], 0) + 1
    contagens = sorted(por_sessao.values())
    if len(contagens) >= 5:
        mediana = contagens[len(contagens) // 2]
        maximo = contagens[-1]
        if mediana > 0 and maximo > mediana * 4:
            sessao = next((k for k, v in por_sessao.items() if v == maximo), None)
            achados.append({
                "regra": "R5", "severidade": "informativo", "titulo": "Volume anômalo de mensagens em sessão do agente",
                "evidencia": {"session_id": sessao, "quantidade": maximo, "mediana": mediana},
            })
    return achados


def patrulha_gaviao(ctx, horas: int = 24) -> list[dict]:
    msgs = ler_mensagens_recentes(ctx, horas)
    return analisar(msgs) if msgs else []


def rodar_patrulha_gaviao(ctx) -> dict:
    achados = patrulha_gaviao(ctx)
    if not achados:
        return {"achados": 0, "novos": 0}
    novos = registrar_incidentes(
        ctx, achados, chave_dedup,
        lambda a: {"patrulha": "hermes", "severidade": a["severidade"], "titulo": f"[Gaviao] {a['titulo']}",
                   "evidencia": a["evidencia"], "chave_dedup": chave_dedup(a)},
        falha_lanca=False, contexto="gaviao",  # no TS a falha do insert só vira aviso
    )
    return {"achados": len(achados), "novos": novos}
