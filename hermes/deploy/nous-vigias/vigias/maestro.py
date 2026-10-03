"""Números do maestro (Coruja Lab), decisão do RT de 03/10/2026.

O Lab acompanha as outras Corujas SÓ por números agregados e não tem acesso ao
banco. Este módulo monta o arquivo que chega a ele:

  /opt/data/maestro-saida/numeros.json   (diretório 755, arquivo 644)

com a RPC ``hermes_maestro_totais`` (contagens de 7 dias; a função já não
devolve pessoa nem texto livre) e com o estado dos vigias lido dos logs do
próprio contêiner (``/opt/data/logs/vigias/<job>-AAAA-MM-DD.log``, formato de
comum._configurar_log). Dos logs só saem: nome do job, hora da última
execução, se deu certo, quantas execuções e quantas falhas em 7 dias. O texto
das mensagens de falha NÃO sai.

Formato combinado com o plugin maestro (hermes/deploy/nous-lab/plugins/maestro):
- ``gateway``: lista de linhas {origem, dia, total, bloqueados, com_erro, ...};
- ``vigias``: {job: {ultima_execucao, ok, execucoes, falhas}} — ``falhas`` é a
  contagem de 7 dias (o plugin aponta o job se for > 0 ou se ``ok`` for false);
- ``gerado_em`` em horário de Brasília com deslocamento (o plugin usa a data
  dele como "dia de referência", que tem de ser o dia civil de Brasília).

Não depende de VIGIAS_MODO: não grava no banco (a conexão é sempre somente
leitura), só escreve o arquivo.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import re
import sys
import tempfile

from .banco import Banco
from .comum import BRASILIA, agora_utc, data_brasilia, log, pasta_logs, _configurar_log, _uma_linha

JOB = "maestro_numeros"
JANELA_DIAS = 7
SAIDA_PADRAO = "/opt/data/maestro-saida"
ARQUIVO = "numeros.json"

_RE_ARQUIVO = re.compile(r"^([a-z][a-z0-9_]{0,62})-(\d{4}-\d{2}-\d{2})\.log$")
# "2026-10-03 12:34:56,789 INFO [job] concluído (modo sombra): ..." / "... ERROR [job] falhou: ..."
_RE_LINHA = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d{3} [A-Z]+ \[([a-z][a-z0-9_]{0,62})\] (concluído|falhou)\b"
)
# Chaves que nunca podem aparecer no arquivo (segunda trava, além da função).
_RE_CHAVE_PROIBIDA = re.compile(
    r"(perfil|nome|texto|trecho|email|e_mail|hash|titulo|mensagem|detalhe|evidencia|medico|paciente|_id$|^id$)",
    re.IGNORECASE,
)


def pasta_saida(amb=os.environ) -> str:
    return (amb.get("MAESTRO_SAIDA") or SAIDA_PADRAO).rstrip("/") or SAIDA_PADRAO


def estado_vigias(pasta: str, agora: _dt.datetime, fuso=None, dias: int = JANELA_DIAS) -> dict:
    """{job: {ultima_execucao, ok, execucoes, falhas}} dos últimos ``dias`` dias
    de Brasília. O horário do log é o relógio local do processo que o escreveu
    (o mesmo contêiner); ``fuso`` troca isso nos testes."""
    desde = data_brasilia(agora, -(dias - 1))
    jobs: dict[str, dict] = {}
    try:
        nomes = sorted(os.listdir(pasta))
    except OSError:
        return {}
    for nome in nomes:
        m = _RE_ARQUIVO.match(nome)
        if not m or m.group(2) < desde:
            continue
        try:
            with open(os.path.join(pasta, nome), encoding="utf-8", errors="replace") as f:
                linhas = f.readlines()
        except OSError:
            continue
        for linha in linhas:
            r = _RE_LINHA.match(linha)
            if not r:
                continue
            quando = _dt.datetime.strptime(r.group(1), "%Y-%m-%d %H:%M:%S")
            quando = quando.replace(tzinfo=fuso) if fuso is not None else quando.astimezone()
            ok = r.group(3) == "concluído"
            j = jobs.setdefault(r.group(2), {"ultima_execucao": None, "ok": None, "execucoes": 0, "falhas": 0, "_t": None})
            j["execucoes"] += 1
            j["falhas"] += 0 if ok else 1
            if j["_t"] is None or quando >= j["_t"]:
                j["_t"] = quando
                j["ok"] = ok
    saida = {}
    for job, j in sorted(jobs.items()):
        t = j.pop("_t")
        j["ultima_execucao"] = t.astimezone(BRASILIA).isoformat(timespec="seconds")
        saida[job] = j
    return saida


def conferir_sem_chave_proibida(obj, caminho: str = "$") -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if _RE_CHAVE_PROIBIDA.search(str(k)):
                raise ValueError(f"chave proibida no numeros.json: {caminho}.{k}")
            conferir_sem_chave_proibida(v, f"{caminho}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            conferir_sem_chave_proibida(v, f"{caminho}[{i}]")


def montar(banco, agora: _dt.datetime, pasta_logs_vigias: str, fuso=None) -> dict:
    totais = banco.rpc("hermes_maestro_totais") or {}
    if not isinstance(totais, dict) or not isinstance(totais.get("gateway"), list):
        raise ValueError("hermes_maestro_totais devolveu formato inesperado")
    dados = {
        "gerado_em": agora.astimezone(BRASILIA).isoformat(timespec="seconds"),
        "janela_dias": JANELA_DIAS,
        "desde": totais.get("desde"),
        "ate": totais.get("ate"),
        "gateway": totais.get("gateway") or [],
        "incidentes": totais.get("incidentes") or [],
        "alertas": totais.get("alertas") or [],
        "notificacoes": totais.get("notificacoes") or [],
        "vigias": estado_vigias(pasta_logs_vigias, agora, fuso),
    }
    conferir_sem_chave_proibida(dados)
    return dados


def gravar_atomico(pasta: str, dados: dict) -> str:
    """Escreve <pasta>/numeros.json de uma vez (temporário + os.replace), com
    diretório 755 e arquivo 644: o Lab roda com outro uid e só lê."""
    os.makedirs(pasta, exist_ok=True)
    os.chmod(pasta, 0o755)
    destino = os.path.join(pasta, ARQUIVO)
    fd, tmp = tempfile.mkstemp(prefix=".numeros-", suffix=".tmp", dir=pasta)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, destino)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return destino


def executar_maestro(ambiente: dict | None = None, relogio=agora_utc, banco_fabrica=None) -> int:
    """Roda uma vez. Nada no stdout; em falha, uma linha no stderr e código 1
    (o arquivo anterior fica como está e o Lab avisa que os dados envelheceram)."""
    amb = os.environ if ambiente is None else ambiente
    _configurar_log(JOB)
    banco = None
    try:
        url = (amb.get("HERMES_PG_JOB_URL") or "").strip()
        if not url and banco_fabrica is None:
            print(f"[vigias] {JOB}: HERMES_PG_JOB_URL ausente no ambiente do Nous", file=sys.stderr)
            return 1
        banco = banco_fabrica() if banco_fabrica else Banco(url, somente_leitura=True, nome_app="coruja-maestro")
        agora = relogio()
        dados = montar(banco, agora, os.path.join(pasta_logs(), "vigias"))
        destino = gravar_atomico(pasta_saida(amb), dados)
        log.info("[%s] concluído (modo arquivo): %s linhas de gateway, %s vigias em %s",
                 JOB, len(dados["gateway"]), len(dados["vigias"]), destino)
        return 0
    except Exception as e:  # noqa: BLE001
        log.error("[%s] falhou: %s", JOB, _uma_linha(e, 500))
        print(f"[vigias] {JOB} falhou: {type(e).__name__}: {_uma_linha(e)}", file=sys.stderr)
        return 1
    finally:
        if banco is not None and hasattr(banco, "fechar"):
            banco.fechar()
        for h in list(log.handlers):
            h.close()
            log.removeHandler(h)
