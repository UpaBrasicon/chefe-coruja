"""Agenda dos vigias no cron do Nous (usado por instalar.sh / remover.sh, DENTRO
do contêiner hermes-agent; só biblioteca padrão).

Os horários são os de hermes/src/queue/agendador.ts, que estão em UTC (o
hermes-app roda em UTC). O cron do Nous NÃO usa UTC: ele casa a expressão no
relógio de parede do fuso configurado — HERMES_TIMEZONE, depois ``timezone:``
do config.yaml, senão o fuso local do processo (hermes_time.get_timezone). O
hermes-agent é recriado com TZ=America/Sao_Paulo (recriar-agente.sh), então na
prática as expressões precisam ir em horário de Brasília. Este arquivo
descobre o fuso do Nous e converte as expressões UTC para ele.

Uso:
  python3 agenda.py linhas            → nome<TAB>script<TAB>expressão no fuso do Nous
  python3 agenda.py fuso              → fuso e deslocamento encontrados
  python3 agenda.py ids <nome> [jobs.json] → ids dos jobs com esse nome (um por linha)
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import sys

PASTA_NOUS = "coruja-vigias"  # subpasta de $HERMES_HOME/scripts

# (nome do job no Nous, script, expressão UTC — igual ao agendador.ts)
AGENDA_UTC = [
    ("coruja-sentinela_escala", "sentinela.py", "30 9 * * 1"),          # seg 06h30 BR
    ("coruja-gaviao_relatorio_semanal", "relatorio.py", "15 11 * * 1"),  # seg 08h15 BR
    # No BullMQ é `every: 3_600_000` (o comentário diz "minuto 5"): aqui, minuto 5 de toda hora.
    ("coruja-cerbero_dados", "cerbero_dados.py", "5 * * * *"),
    ("coruja-cerbero_hermes", "cerbero_hermes.py", "0 8 * * *"),         # 05h BR
    ("coruja-gaviao_patrulha", "gaviao_patrulha.py", "0 11,23 * * *"),   # 08h e 20h BR
    ("coruja-argos_auditoria", "argos.py", "0 9,21 * * *"),              # 06h e 18h BR
    ("coruja-vigia_porta", "vigia_porta.py", "5 10,22 * * *"),           # 07h05 e 19h05 BR
    ("coruja-vigia_presenca", "vigia_presenca.py", "*/15 * * * *"),
    ("coruja-vigia_escala", "vigia_escala.py", "0 11 * * *"),            # 08h BR
    ("coruja-vigia_tardios", "vigia_tardios.py", "2 11 * * *"),          # 08h02 BR
    ("coruja-guardiao_prontuario", "guardiao_prontuario.py", "20 * * * *"),
    ("coruja-cadeia_auditoria", "cadeia_auditoria.py", "0 7 * * *"),     # 04h BR
]


def converter(expressao: str, deslocamento_horas: int) -> str:
    """Expressão cron em UTC → mesmo instante no fuso de deslocamento dado
    (ex.: -3). Só mexe no campo da hora; se a conta virar o dia e a expressão
    restringir dia/mês/semana, recusa (não é o caso de nenhum vigia)."""
    campos = expressao.split()
    if len(campos) != 5:
        raise ValueError(f"expressão cron inesperada: {expressao}")
    minuto, hora, dia, mes, semana = campos
    if deslocamento_horas == 0 or hora == "*" or hora.startswith("*/"):
        if hora.startswith("*/") and deslocamento_horas and 24 % int(hora[2:]) != 0:
            raise ValueError(f"passo de hora que não divide 24: {expressao}")
        return expressao
    horas = []
    virou = False
    for h in hora.split(","):
        if not h.isdigit():
            raise ValueError(f"campo de hora não suportado: {expressao}")
        bruto = int(h) + deslocamento_horas
        virou = virou or not (0 <= bruto <= 23)
        horas.append(bruto % 24)
    if virou and (dia, mes, semana) != ("*", "*", "*"):
        raise ValueError(f"a conversão vira o dia numa expressão com dia restrito: {expressao}")
    return " ".join([minuto, ",".join(str(h) for h in sorted(horas)), dia, mes, semana])


def _timezone_config(home: str) -> str | None:
    """``timezone:`` de topo do config.yaml (leitura simples, sem PyYAML)."""
    try:
        with open(os.path.join(home, "config.yaml"), encoding="utf-8") as f:
            for linha in f:
                if linha.startswith("timezone:"):
                    v = linha.split(":", 1)[1].split("#", 1)[0].strip().strip("'\"")
                    return v or None
    except OSError:
        return None
    return None


def fuso_do_nous(ambiente=os.environ, agora: _dt.datetime | None = None) -> tuple[str, int]:
    """(origem, deslocamento em minutos) — mesma ordem do hermes_time do Nous."""
    agora = agora or _dt.datetime.now(_dt.timezone.utc)
    nome = (ambiente.get("HERMES_TIMEZONE") or "").strip() or _timezone_config(ambiente.get("HERMES_HOME") or "/opt/data")
    if nome:
        from zoneinfo import ZoneInfo

        off = agora.astimezone(ZoneInfo(nome)).utcoffset()
        return (f"timezone {nome}", int(off.total_seconds() // 60))
    off = agora.astimezone().utcoffset()  # fuso local do processo (TZ)
    return ("fuso local (TZ)", int(off.total_seconds() // 60))


def linhas(deslocamento_minutos: int) -> list[tuple[str, str, str]]:
    if deslocamento_minutos % 60:
        raise ValueError("fuso do Nous com fração de hora: ajuste a agenda à mão")
    return [(n, s, converter(e, deslocamento_minutos // 60)) for n, s, e in AGENDA_UTC]


def ids_por_nome(nome: str, caminho: str) -> list[str]:
    """Ids dos jobs com esse nome no jobs.json do Nous (formato tolerante: lista
    ou objeto com lista; procura dicionários com "name")."""
    try:
        with open(caminho, encoding="utf-8") as f:
            dados = json.load(f)
    except (OSError, ValueError):
        return []
    achados: list[str] = []

    def andar(x):
        if isinstance(x, dict):
            if str(x.get("name", "")).lower() == nome.lower() and x.get("id"):
                achados.append(str(x["id"]))
            for v in x.values():
                andar(v)
        elif isinstance(x, list):
            for v in x:
                andar(v)

    andar(dados)
    return achados


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    if argv[0] == "fuso":
        origem, minutos = fuso_do_nous()
        print(f"{origem}: UTC{minutos / 60:+g}")
        return 0
    if argv[0] == "linhas":
        _, minutos = fuso_do_nous()
        for n, s, e in linhas(minutos):
            print(f"{n}\t{PASTA_NOUS}/{s}\t{e}")
        return 0
    if argv[0] == "ids" and len(argv) >= 2:
        caminho = argv[2] if len(argv) > 2 else os.path.join(os.environ.get("HERMES_HOME") or "/opt/data", "cron", "jobs.json")
        for i in ids_por_nome(argv[1], caminho):
            print(i)
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
