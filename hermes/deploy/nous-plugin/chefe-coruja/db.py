"""Conexão do plugin com o banco (migração Hermes → Nous, etapa 1; RT 02/10/2026).

O plugin fala com o Postgres pelo pooler da Supabase como ``hermes_app_user``
(herda ``hermes_user``: zero grant de tabela, só EXECUTE nas RPCs ``hermes_*``).
URL em ``HERMES_PG_USER_URL`` no ambiente do contêiner do Nous.

O driver é o ``asyncpg`` que já vem na imagem do Nous. As ferramentas do
plugin são síncronas e podem rodar dentro de um loop asyncio do próprio Nous,
então o banco tem um loop só dele, numa thread separada; cada chamada espera o
resultado com timeout.

Contrato de ``rpc(nome, params)``: igual ao PostgREST —
- função que devolve SETOF/TABLE → lista de dicts;
- função escalar (inclusive jsonb) → o valor (dict/list/str/número/None).
Os parâmetros vão como argumentos NOMEADOS (``p_x => $1``), sempre como
parâmetro do driver, nunca no texto do SQL. O nome da função passa pela
allowlist e pelo formato de identificador.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import threading

_RE_NOME = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
_TIMEOUT = 20


class ErroBanco(RuntimeError):
    """Falha ao falar com o banco (mensagem curta, sem dado)."""


class DriverNaoConfigurado(ErroBanco):
    """Sem HERMES_PG_USER_URL (ou sem asyncpg): o plugin responde 'backend indisponível'."""


class _Banco:
    def __init__(self, url: str, permitidas: frozenset[str]):
        self._url = url
        self._permitidas = permitidas
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._loop.run_forever, name="coruja-db", daemon=True)
        self._thread.start()
        self._pool = None
        self._tipos: dict[str, tuple[bool, dict[str, str]]] = {}

    def _rodar(self, coro):
        return asyncio.run_coroutine_threadsafe(coro, self._loop).result(timeout=_TIMEOUT)

    async def _pool_pronto(self):
        if self._pool is None:
            import asyncpg  # já vem na imagem do Nous

            async def _init(conn):
                # jsonb/json chegam como objeto Python, como no PostgREST
                for tipo in ("json", "jsonb"):
                    await conn.set_type_codec(tipo, encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

            self._pool = await asyncpg.create_pool(
                self._url, min_size=0, max_size=3, statement_cache_size=0,
                command_timeout=15, init=_init, server_settings={"application_name": "coruja-nous"},
            )
        return self._pool

    async def _assinatura(self, conn, nome: str) -> tuple[bool, dict[str, str]]:
        """(devolve conjunto?, {argumento de entrada: tipo}) da função public.<nome>."""
        if nome not in self._tipos:
            linha = await conn.fetchrow(
                "select p.proretset or p.prorettype = 'pg_catalog.record'::regtype as conjunto,"
                " coalesce(p.proargnames, '{}') as nomes, p.proargmodes::text[] as modos,"
                " array(select format_type(t, null) from unnest(p.proargtypes) t) as tipos"
                " from pg_proc p join pg_namespace n on n.oid = p.pronamespace"
                " where n.nspname = 'public' and p.proname = $1",
                nome,
            )
            if linha is None:
                raise ErroBanco(f"função {nome} não existe")
            modos = linha["modos"] or []
            entradas = [a for i, a in enumerate(linha["nomes"]) if not modos or modos[i] in ("i", "b", "v")]
            # proargtypes traz só os de entrada, na mesma ordem
            self._tipos[nome] = (bool(linha["conjunto"]) or bool(modos and "t" in modos), dict(zip(entradas, linha["tipos"])))
        return self._tipos[nome]

    async def _rpc(self, nome: str, params: dict):
        pool = await self._pool_pronto()
        async with pool.acquire() as conn:
            conjunto, entradas = await self._assinatura(conn, nome)
            desconhecidos = set(params) - set(entradas)
            if desconhecidos:
                raise ErroBanco(f"parâmetro inválido para {nome}: {sorted(desconhecidos)}")
            # todo valor vai como texto/json e o Postgres converte para o tipo do argumento
            nomes = [k for k in params if _RE_NOME.match(k)]
            valores = [
                json.dumps(params[k]) if isinstance(params[k], (dict, list)) else (None if params[k] is None else str(params[k]))
                for k in nomes
            ]
            # $n vai como texto e o Postgres converte para o tipo do argumento (tipo vem do catálogo)
            def _arg(i: int, k: str) -> str:
                tipo = entradas[k]
                if tipo.endswith("[]"):
                    # lista chega como JSON; vira array do Postgres na ordem original
                    return (f"{k} => (select coalesce(array_agg(x.v order by x.n), '{{}}') from"
                            f" jsonb_array_elements_text(${i + 1}::text::jsonb) with ordinality x(v, n))::{tipo}")
                return f"{k} => (${i + 1}::text)::{tipo}"
            args = ", ".join(_arg(i, k) for i, k in enumerate(nomes))
            if conjunto:
                linhas = await conn.fetch(f"select row_to_json(t)::jsonb as r from (select * from public.{nome}({args})) t", *valores)
                return [l["r"] for l in linhas]
            return await conn.fetchval(f"select to_jsonb(public.{nome}({args}))", *valores)

    def rpc(self, nome: str, params: dict | None = None):
        if not _RE_NOME.match(nome) or not (nome in self._permitidas if self._permitidas else _RE_PERMITIDA.match(nome)):
            raise ErroBanco(f"função fora da lista: {nome}")
        try:
            return self._rodar(self._rpc(nome, params or {}))
        except ErroBanco:
            raise
        except Exception as e:  # noqa: BLE001 — erro do banco/rede, sem ecoar dado
            codigo = getattr(e, "sqlstate", None) or type(e).__name__
            raise ErroBanco(f"falha no banco ({codigo}): {str(e)[:160]}") from None


_banco: _Banco | None = None
_trava = threading.Lock()


# Segunda trava, além da allowlist RPC_USUARIO do consulta.py: só funções do Hermes.
_RE_PERMITIDA = re.compile(r"^(hermes_[a-z0-9_]+|confirmar_vinculo_hermes)$")


def criar_rpc(permitidas: frozenset[str] | set[str] | None = None):
    """Devolve ``rpc(nome, params)`` ligado a HERMES_PG_USER_URL (um pool por processo)."""
    global _banco
    url = os.environ.get("HERMES_PG_USER_URL", "").strip()
    if not url:
        raise DriverNaoConfigurado("HERMES_PG_USER_URL não configurada no contêiner do Nous")
    try:
        import asyncpg  # noqa: F401 — já vem na imagem do Nous
    except ImportError:
        raise DriverNaoConfigurado("asyncpg ausente no contêiner do Nous") from None
    with _trava:
        if _banco is None:
            _banco = _Banco(url, frozenset(permitidas or ()))
    return _banco.rpc
