"""Peças comuns dos vigias: relógio, equivalências com o JavaScript, modo
sombra/valer, camada de gravação e o executor dos scripts do cron.

Por que as "equivalências com o JS": a chave de dedup, o texto das
notificações e os números gravados precisam sair IGUAIS aos do Hermes (TS),
senão a comparação na sombra acusa diferença que não existe e, depois da
virada, incidentes abertos pelo Hermes seriam duplicados. Então:
- ``js_slice`` corta como ``String.prototype.slice`` (unidades UTF-16);
- ``js_num`` escreve número como ``String(n)`` do JS (3, 0.75, 1e-7);
- ``js_round`` arredonda como ``Math.round`` (meio para cima);
- ``iso_js`` escreve data como ``Date.toISOString()``.
"""

from __future__ import annotations

import datetime as _dt
import decimal
import hashlib
import json
import logging
import math
import os
import sys
import uuid

from .banco import Banco, ErroBanco

log = logging.getLogger("vigias")

UTC = _dt.timezone.utc
try:
    from zoneinfo import ZoneInfo

    BRASILIA = ZoneInfo("America/Sao_Paulo")
except Exception:  # noqa: BLE001 — sem tzdata: Brasília não tem horário de verão desde 2019
    BRASILIA = _dt.timezone(_dt.timedelta(hours=-3), "BRT")

MODOS = ("sombra", "valer")


# ── Relógio ──────────────────────────────────────────────────────────────────
def agora_utc() -> _dt.datetime:
    return _dt.datetime.now(UTC)


def iso_js(dt: _dt.datetime) -> str:
    """``Date.prototype.toISOString()``: UTC, milissegundos, sufixo Z."""
    u = dt.astimezone(UTC)
    return u.strftime("%Y-%m-%dT%H:%M:%S.") + f"{u.microsecond // 1000:03d}Z"


def data_brasilia(dt: _dt.datetime, deslocamento_dias: int = 0) -> str:
    """Data civil de Brasília (igual a hojeBrasilia de lib/tempo.ts)."""
    return (dt + _dt.timedelta(days=deslocamento_dias)).astimezone(BRASILIA).date().isoformat()


def ms_epoch(texto: str) -> int | None:
    """``new Date(texto).getTime()`` para as strings ISO que o Postgres devolve.
    Sem fuso na string (ex.: '2026-09-01T23:59:59'), o JS usa o fuso LOCAL do
    processo — o contêiner do hermes-app roda em UTC, então aqui também é UTC."""
    try:
        t = texto.replace("Z", "+00:00")
        dt = _dt.datetime.fromisoformat(t)
    except (ValueError, AttributeError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    delta = dt - _dt.datetime(1970, 1, 1, tzinfo=UTC)
    # o JS guarda milissegundos: microssegundos são truncados
    return (delta.days * 86_400 + delta.seconds) * 1000 + delta.microseconds // 1000


# ── Equivalências com o JavaScript ───────────────────────────────────────────
def js_slice(texto: str, n: int) -> str:
    """``texto.slice(0, n)`` do JS (conta unidades UTF-16; emoji vale 2).
    Corte no meio de um par substituto vira U+FFFD, como no UTF-8 do Node."""
    b = texto.encode("utf-16-le", "surrogatepass")
    if len(b) <= 2 * n:
        return texto
    s = b[: 2 * n].decode("utf-16-le", "surrogatepass")
    return "".join("�" if 0xD800 <= ord(c) <= 0xDFFF else c for c in s)


def js_round(x: float) -> int:
    """``Math.round``: meio vai para +infinito (o round do Python é bancário)."""
    return math.floor(x + 0.5)


def js_num(x) -> str:
    """``String(n)`` do JS para um número."""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int):
        x = float(x) if abs(x) >= 2**53 else x
        if isinstance(x, int):
            return str(x)
    if math.isnan(x):
        return "NaN"
    if math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    if x == 0:
        return "0"
    sinal = "-" if x < 0 else ""
    d = decimal.Decimal(repr(abs(x)))  # repr = dígitos mínimos, como o JS
    t = d.as_tuple()
    digitos = "".join(map(str, t.digits)).rstrip("0") or "0"
    # posição do ponto decimal (n do algoritmo Number::toString do ECMAScript)
    n = len(t.digits) + t.exponent
    k = len(digitos)
    if k <= n <= 21:
        return sinal + digitos + "0" * (n - k)
    if 0 < n <= 21:
        return sinal + digitos[:n] + "." + digitos[n:]
    if -6 < n <= 0:
        return sinal + "0." + "0" * (-n) + digitos
    e = n - 1
    exp = f"e{'+' if e >= 0 else '-'}{abs(e)}"
    return sinal + (digitos if k == 1 else digitos[0] + "." + digitos[1:]) + exp


def sha256(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


# ── Registro da sombra ───────────────────────────────────────────────────────
def pasta_logs() -> str:
    return os.environ.get("VIGIAS_LOG_BASE", "/opt/data/logs").rstrip("/") or "/opt/data/logs"


def pasta_sombra() -> str:
    return os.path.join(pasta_logs(), "vigias-sombra")


class RegistroSombra:
    """Uma linha JSON por gravação que o job FARIA. Só IDs, chaves em hash e
    contagens: texto livre (mensagem, trecho de conversa, evidência) nunca
    entra aqui."""

    def __init__(self, job: str, relogio=agora_utc, pasta: str | None = None):
        self.job = job
        self._relogio = relogio
        self._pasta = pasta
        self.linhas: list[dict] = []  # cópia em memória (testes)

    def caminho(self) -> str:
        return os.path.join(self._pasta or pasta_sombra(), f"{self.job}-{data_brasilia(self._relogio())}.jsonl")

    def anotar(self, registro: dict) -> None:
        linha = {"ts": iso_js(self._relogio()), "job": self.job, **registro}
        self.linhas.append(linha)
        caminho = self.caminho()
        os.makedirs(os.path.dirname(caminho), mode=0o750, exist_ok=True)
        with open(caminho, "a", encoding="utf-8") as f:
            f.write(json.dumps(linha, ensure_ascii=False, sort_keys=True) + "\n")


class RegistroMemoria(RegistroSombra):
    """Igual, sem arquivo (testes)."""

    def anotar(self, registro: dict) -> None:
        self.linhas.append({"ts": iso_js(self._relogio()), "job": self.job, **registro})


# ── Camada de gravação ───────────────────────────────────────────────────────
class Gravacao:
    """As quatro gravações dos vigias. Em ``valer`` vão ao banco; em ``sombra``
    viram linha no registro e NADA é gravado (o banco da sombra é, além disso,
    somente leitura)."""

    def __init__(self, banco, modo: str, registro: RegistroSombra | None, gerar_id=lambda: str(uuid.uuid4())):
        if modo not in MODOS:
            raise ValueError(f"modo inválido: {modo}")
        self.banco = banco
        self.modo = modo
        self.registro = registro
        self._gerar_id = gerar_id

    @property
    def sombra(self) -> bool:
        return self.modo == "sombra"

    def anotar(self, registro: dict) -> None:
        """Informação extra só da sombra (ex.: chave que já estava aberta)."""
        if self.sombra and self.registro is not None:
            self.registro.anotar(registro)

    def inserir_incidentes(self, linhas: list[dict]) -> None:
        if not linhas:
            return
        if self.sombra:
            for l in linhas:
                self.registro.anotar({
                    "tabela": "cerbero_incidentes", "acao": "inserir",
                    "patrulha": l["patrulha"], "severidade": l["severidade"], "titulo": l["titulo"],
                    "chave_sha256": sha256(l.get("chave_dedup") or ""),
                })
            return
        self.banco.escrever("inserir_incidentes", [
            {"patrulha": l["patrulha"], "severidade": l["severidade"], "titulo": l["titulo"],
             "evidencia": l["evidencia"], "chave_dedup": l.get("chave_dedup")}
            for l in linhas
        ])

    def inserir_alerta_escala(self, a: dict) -> None:
        # Número não finito (limite Infinity em amostra pequena) vira NULL —
        # igual ao TS.
        def num(x):
            return js_num(x) if isinstance(x, (int, float)) and math.isfinite(x) else None

        if self.sombra:
            self.registro.anotar({
                "tabela": "chronos_alertas_escala", "acao": "inserir",
                "unidade_id": a["unidade_id"], "medico_id": a["medico_id"], "janela": a["janela"],
                "metrica": a["metrica"], "valor": num(a["valor"]),
                "mediana_unidade": num(a["mediana_unidade"]), "limite_outlier": num(a["limite_outlier"]),
            })
            return
        self.banco.escrever(
            "inserir_alerta_escala", a["unidade_id"], a["medico_id"], a["janela"], a["metrica"],
            num(a["valor"]), num(a["mediana_unidade"]), num(a["limite_outlier"]), a["detalhe"],
        )

    def inserir_notificacao(self, n: dict) -> str:
        id_ = self._gerar_id()
        if self.sombra:
            self.registro.anotar({
                "tabela": "notificacoes_plantonista", "acao": "inserir",
                "perfil_id": n["perfil_id"], "unidade_id": n["unidade_id"], "tipo": n["tipo"], "data": n["data"],
                "mensagem_sha256": sha256(n["mensagem"]), "mensagem_chars": len(n["mensagem"]),
            })
            return id_
        self.banco.escrever("inserir_notificacao", id_, n["perfil_id"], n["unidade_id"], n["tipo"], n["mensagem"], n["data"])
        return id_

    def inserir_relatorio(self, r: dict) -> str:
        id_ = self._gerar_id()  # gerado aqui: hermes_job não tem SELECT na tabela
        if self.sombra:
            self.registro.anotar({
                "tabela": "gaviao_relatorios_semanais", "acao": "inserir", "id": id_,
                "periodo_inicio": r["periodo_inicio"], "periodo_fim": r["periodo_fim"],
                "resumo": r["resumo"],  # só contagens e período
                "detalhes_itens": len(r["detalhes"].get("incidentes", [])) + len(r["detalhes"].get("alertas", [])),
            })
            return id_
        self.banco.escrever("inserir_relatorio", id_, r["periodo_inicio"], r["periodo_fim"], r["resumo"], r["detalhes"])
        return id_


class Contexto:
    """O que cada job recebe: leituras (``banco``), gravações (``grava``) e o relógio."""

    def __init__(self, banco, grava: Gravacao, relogio=agora_utc, ambiente: dict | None = None):
        self.banco = banco
        self.grava = grava
        self.relogio = relogio
        self.ambiente = os.environ if ambiente is None else ambiente

    def agora(self) -> _dt.datetime:
        return self.relogio()

    def hoje(self, deslocamento_dias: int = 0) -> str:
        return data_brasilia(self.relogio(), deslocamento_dias)


# ── Executor dos scripts do cron ─────────────────────────────────────────────
def _configurar_log(job: str) -> None:
    """Log de execução em arquivo (o stdout tem de ficar VAZIO: o que sai nele
    o Nous entrega no canal do job)."""
    log.setLevel(logging.INFO)
    log.propagate = False
    for h in list(log.handlers):
        log.removeHandler(h)
    try:
        pasta = os.path.join(pasta_logs(), "vigias")
        os.makedirs(pasta, mode=0o750, exist_ok=True)
        h = logging.FileHandler(os.path.join(pasta, f"{job}-{data_brasilia(agora_utc())}.log"), encoding="utf-8")
        h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        log.addHandler(h)
    except OSError:
        log.addHandler(logging.NullHandler())


def _uma_linha(texto: str, limite: int = 200) -> str:
    return " ".join(str(texto).split())[:limite]


def executar(job: str, funcao, ambiente: dict | None = None) -> int:
    """Roda o job e devolve o código de saída. Nada no stdout; em falha, UMA
    linha no stderr e código 1 (o cron do Nous registra a falha)."""
    amb = os.environ if ambiente is None else ambiente
    _configurar_log(job)
    try:
        return _executar(job, funcao, amb)
    finally:
        for h in list(log.handlers):
            h.close()
            log.removeHandler(h)


def _executar(job: str, funcao, amb) -> int:
    modo = (amb.get("VIGIAS_MODO") or "sombra").strip().lower()
    if modo not in MODOS:
        print(f"[vigias] {job}: VIGIAS_MODO inválido (use sombra ou valer)", file=sys.stderr)
        return 2
    url = (amb.get("HERMES_PG_JOB_URL") or "").strip()
    if not url:
        print(f"[vigias] {job}: HERMES_PG_JOB_URL ausente no ambiente do Nous", file=sys.stderr)
        return 1
    banco = Banco(url, somente_leitura=(modo == "sombra"))
    registro = RegistroSombra(job) if modo == "sombra" else None
    ctx = Contexto(banco, Gravacao(banco, modo, registro), ambiente=amb)
    try:
        resultado = funcao(ctx)
        log.info("[%s] concluído (modo %s): %s", job, modo, resultado)
        return 0
    except Exception as e:  # noqa: BLE001
        log.error("[%s] falhou: %s", job, _uma_linha(e, 500))
        print(f"[vigias] {job} falhou ({modo}): {type(e).__name__}: {_uma_linha(e)}", file=sys.stderr)
        return 1
    finally:
        banco.fechar()


__all__ = [
    "BRASILIA", "Banco", "Contexto", "ErroBanco", "Gravacao", "RegistroMemoria", "RegistroSombra",
    "agora_utc", "data_brasilia", "executar", "iso_js", "js_num", "js_round", "js_slice", "log", "ms_epoch", "sha256",
]
