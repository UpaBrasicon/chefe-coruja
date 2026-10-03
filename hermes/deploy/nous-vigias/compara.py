"""Compara a sombra dos vigias do Nous com o que o Hermes (TS) gravou num dia.

Uso (dentro do contêiner hermes-agent, com o python que tem asyncpg):
  python compara.py [AAAA-MM-DD]      (padrão: ontem, em Brasília)

Lê /opt/data/logs/vigias-sombra/*-<data>.jsonl e consulta o banco como
hermes_app_job, SÓ LEITURA (transação READ ONLY). O dia é o de Brasília.

Regras de "bateu":
- incidentes (cerbero_incidentes): cada incidente que o Hermes abriu no dia tem
  de aparecer na sombra (como "inserir" ou como "ja_aberta" — se o Hermes rodou
  antes, o Nous viu a chave já aberta). Cada "inserir" da sombra tem de existir
  no banco com a mesma chave. Comparação pelo sha256 da chave (a do Gavião leva
  trecho de conversa e por isso não vai em claro para o registro);
- alertas do Sentinela: mesma ideia, por (unidade, médico, janela, métrica);
- notificações e relatório: hermes_job NÃO tem SELECT nessas tabelas. Sem
  VIGIAS_COMPARA_URL (uma conexão de leitura com acesso a elas), o script mostra
  só o que a sombra previu e o SQL para conferir no editor do Supabase.

Saída: resumo no stdout. Código 0 = tudo bateu no que foi comparável; 3 = diferença.
"""

from __future__ import annotations

import datetime as _dt
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.banco import Banco, ErroBanco  # noqa: E402
from vigias.comum import BRASILIA, UTC, iso_js, ms_epoch, pasta_sombra, sha256  # noqa: E402


def limites_do_dia(data: str) -> tuple[str, str]:
    d = _dt.date.fromisoformat(data)
    inicio = _dt.datetime(d.year, d.month, d.day, tzinfo=BRASILIA)
    return iso_js(inicio), iso_js(inicio + _dt.timedelta(days=1))


def ler_sombra(data: str, pasta: str | None = None) -> list[dict]:
    linhas = []
    for caminho in sorted(glob.glob(os.path.join(pasta or pasta_sombra(), f"*-{data}.jsonl"))):
        with open(caminho, encoding="utf-8") as f:
            for l in f:
                l = l.strip()
                if l:
                    try:
                        linhas.append(json.loads(l))
                    except ValueError:
                        pass
    return linhas


def _amostra(itens, n=5) -> str:
    itens = sorted(itens)
    return ", ".join(itens[:n]) + (f" (+{len(itens) - n})" if len(itens) > n else "")


def comparar_incidentes(sombra: list[dict], banco_linhas: list[dict]) -> tuple[bool, list[str]]:
    novas = {l["chave_sha256"]: l for l in sombra if l.get("tabela") == "cerbero_incidentes" and l.get("acao") == "inserir"}
    vistas = {l["chave_sha256"] for l in sombra if l.get("tabela") == "cerbero_incidentes" and l.get("acao") == "ja_aberta"}
    ts = {sha256(r["chave_dedup"]): r for r in banco_linhas if r.get("chave_dedup")}
    so_ts = set(ts) - set(novas) - vistas
    so_nous = set(novas) - set(ts)
    saida = [
        f"cerbero_incidentes: Nous previu {len(novas)} novo(s) e viu {len(vistas)} já aberto(s) · "
        f"Hermes abriu {len(ts)} · bateram {len(set(ts) & (set(novas) | vistas))} · "
        f"só no Hermes {len(so_ts)} · só no Nous {len(so_nous)}"
    ]
    if so_ts:
        saida.append("  só no Hermes: " + _amostra({f"{ts[h]['titulo']} [{h[:10]}]" for h in so_ts}))
    if so_nous:
        saida.append("  só no Nous: " + _amostra({f"{novas[h]['titulo']} [{h[:10]}]" for h in so_nous}))
    return (not so_ts and not so_nous, saida)


def _chave_alerta(l: dict) -> str:
    return f"{l['unidade_id']}|{l['medico_id']}|{l['janela']}|{l['metrica']}"


def comparar_alertas(sombra: list[dict], banco_linhas: list[dict]) -> tuple[bool, list[str]]:
    novas = {_chave_alerta(l) for l in sombra if l.get("tabela") == "chronos_alertas_escala" and l.get("acao") == "inserir"}
    vistas = {_chave_alerta(l) for l in sombra if l.get("tabela") == "chronos_alertas_escala" and l.get("acao") == "ja_aberto"}
    ts = {_chave_alerta(r) for r in banco_linhas}
    so_ts, so_nous = ts - novas - vistas, novas - ts
    saida = [
        f"chronos_alertas_escala: Nous previu {len(novas)} · Hermes gravou {len(ts)} · "
        f"só no Hermes {len(so_ts)} · só no Nous {len(so_nous)}"
    ]
    if so_ts:
        saida.append("  só no Hermes: " + _amostra(so_ts))
    if so_nous:
        saida.append("  só no Nous: " + _amostra(so_nous))
    return (not so_ts and not so_nous, saida)


def _chave_notif(l: dict) -> str:
    return f"{l['perfil_id']}|{l['unidade_id']}|{l['data']}|{l['tipo']}"


def comparar_notificacoes(sombra: list[dict], banco_linhas: list[dict] | None, data: str) -> tuple[bool | None, list[str]]:
    previstas = {_chave_notif(l) for l in sombra if l.get("tabela") == "notificacoes_plantonista" and l.get("data") == data}
    por_tipo: dict[str, int] = {}
    for k in previstas:
        t = k.rsplit("|", 1)[1]
        t = "porta_resumo_*" if t.startswith("porta_resumo_") else "checkin_pendente_*" if t.startswith("checkin_pendente_") else t
        por_tipo[t] = por_tipo.get(t, 0) + 1
    saida = [f"notificacoes_plantonista: Nous previu {len(previstas)} (uma por pessoa/tipo/dia) — "
             + (", ".join(f"{k}: {v}" for k, v in sorted(por_tipo.items())) or "nenhuma")]
    if banco_linhas is None:
        saida.append("  não comparável como hermes_app_job (sem SELECT). Conferir no SQL editor:")
        saida.append(
            "  select tipo, count(*) from public.notificacoes_plantonista where data = '" + data + "'"
            " and (tipo in ('sentinela_escala','escala_buraco','registros_tardios') or tipo like 'porta_resumo_%'"
            " or tipo like 'checkin_pendente_%') group by 1 order by 1;"
        )
        return (None, saida)
    ts = {_chave_notif(r) for r in banco_linhas}
    so_ts, so_nous = ts - previstas, previstas - ts
    saida.append(f"  Hermes gravou {len(ts)} · só no Hermes {len(so_ts)} · só no Nous {len(so_nous)}")
    return (not so_ts and not so_nous, saida)


def comparar_relatorios(sombra: list[dict], banco_linhas: list[dict] | None) -> tuple[bool | None, list[str]]:
    previstos = [l for l in sombra if l.get("tabela") == "gaviao_relatorios_semanais"]
    saida = [f"gaviao_relatorios_semanais: Nous previu {len(previstos)}"]
    if banco_linhas is None:
        if previstos:
            saida.append("  não comparável como hermes_app_job (sem SELECT). Conferir no SQL editor:")
            saida.append("  select periodo_inicio, periodo_fim, resumo->'total_incidentes', resumo->'total_alertas'"
                         " from public.gaviao_relatorios_semanais order by gerado_em desc limit 2;")
            for p in previstos:
                r = p.get("resumo") or {}
                saida.append(f"  previsto: {p.get('periodo_inicio')}..{p.get('periodo_fim')} · incidentes "
                             f"{r.get('total_incidentes')} · alertas {r.get('total_alertas')}")
        return (None, saida)
    ok = True
    for p in previstos:
        r = p.get("resumo") or {}
        # o par é o relatório do Hermes do mesmo período gerado mais perto da hora da sombra
        candidatos = [b for b in banco_linhas if str(b.get("periodo_fim")) == p.get("periodo_fim")]
        ts_sombra = ms_epoch(p.get("ts") or "") or 0
        par = min(candidatos, key=lambda b: abs((ms_epoch(str(b.get("gerado_em"))) or 0) - ts_sombra), default=None)
        if par is None:
            ok = False
            saida.append(f"  só no Nous: relatório até {p.get('periodo_fim')}")
            continue
        rb = par.get("resumo") or {}
        # os dois rodam em minutos diferentes: a janela de 7 dias pode diferir por pouco
        saida.append(f"  {p.get('periodo_fim')}: incidentes Nous {r.get('total_incidentes')} × Hermes {rb.get('total_incidentes')}"
                     f" · alertas Nous {r.get('total_alertas')} × Hermes {rb.get('total_alertas')}")
        ok = ok and r.get("total_alertas") == rb.get("total_alertas") and r.get("total_incidentes") == rb.get("total_incidentes")
    if len(banco_linhas) > len(previstos):
        ok = False
        saida.append(f"  só no Hermes: {len(banco_linhas) - len(previstos)} relatório(s)")
    return (ok, saida)


def main(argv: list[str]) -> int:
    data = argv[0] if argv else (_dt.datetime.now(UTC).astimezone(BRASILIA).date() - _dt.timedelta(days=1)).isoformat()
    _dt.date.fromisoformat(data)  # valida
    inicio, fim = limites_do_dia(data)
    sombra = ler_sombra(data)
    banco = Banco(os.environ.get("HERMES_PG_JOB_URL", ""), somente_leitura=True, nome_app="coruja-vigias-compara")
    extra_url = os.environ.get("VIGIAS_COMPARA_URL", "").strip()
    extra = Banco(extra_url, somente_leitura=True, nome_app="coruja-vigias-compara") if extra_url else banco
    try:
        incidentes = banco.ler("cmp_incidentes_dia", inicio, fim)
        alertas = banco.ler("cmp_alertas_dia", inicio, fim)

        def tentar(nome, *args):
            try:
                return extra.ler(nome, *args)
            except ErroBanco as e:
                if "42501" in str(e) or "permission" in str(e).lower():
                    return None
                raise

        notifs = tentar("cmp_notificacoes_dia", data)
        relatorios = tentar("cmp_relatorios_dia", inicio, fim)
    finally:
        banco.fechar()
        if extra is not banco:
            extra.fechar()

    print(f"Vigias — sombra do Nous × Hermes em {data} (Brasília) · {len(sombra)} linha(s) de sombra")
    resultados = []
    for ok, linhas in (
        comparar_incidentes(sombra, incidentes),
        comparar_alertas(sombra, alertas),
        comparar_notificacoes(sombra, notifs, data),
        comparar_relatorios(sombra, relatorios),
    ):
        resultados.append(ok)
        for l in linhas:
            print(l)
    diverge = any(r is False for r in resultados)
    print("RESULTADO: " + ("DIFERENÇA — investigar antes de virar" if diverge else "bateu no que foi comparável"))
    return 3 if diverge else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
