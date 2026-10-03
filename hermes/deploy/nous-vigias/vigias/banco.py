"""Banco dos vigias: Postgres direto como ``hermes_app_job`` (herda ``hermes_job``).

Porte de hermes/src/lib/db-job.ts + o shim ``.rpc()`` de hermes/src/lib/pg.ts,
com o driver ``asyncpg`` que já vem na imagem do Nous (sem pip). Mesma linha
do plugin (hermes/deploy/nous-plugin/chefe-coruja/db.py):

- nada recebe nome de tabela/coluna/função de fora: as consultas e gravações
  são FIXAS (dicionários abaixo) e as RPCs passam por allowlist (RPC_JOB, a
  mesma de hermes/src/lib/supabase.ts) e pelo formato de identificador;
- todo valor vai como parâmetro do driver (texto, convertido no SQL), nunca
  no texto do SQL; argumentos de RPC nomeados, tipos lidos do catálogo
  (pg_proc), como o PostgREST faz;
- linhas em JSON gerado pelo próprio Postgres (json_agg/to_json), igual ao
  ``linhasJson`` do TS: datas como string ISO, bigint como número — as chaves
  de dedup montadas com essas strings ficam idênticas às do Hermes.

No modo sombra a conexão é aberta com ``somente_leitura=True``: toda leitura
roda em transação READ ONLY e qualquer gravação é recusada aqui mesmo (segunda
trava, além da camada de gravação em comum.py).

Os scripts do cron são processos curtos e síncronos: um loop asyncio próprio e
UMA conexão por execução (o papel tem CONNECTION LIMIT 6, dividido com o
hermes-app enquanto os dois rodam juntos).
"""

from __future__ import annotations

import asyncio
import json
import re

_RE_NOME = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
# format_type devolve coisas como `uuid`, `text[]`, `timestamp with time zone`.
_RE_TIPO = re.compile(r'^[a-z0-9_ ."\[\](),]+$', re.IGNORECASE)
_TIMEOUT = 150  # o papel tem statement_timeout de 120 s

# RPCs de verificação dos crons (EXECUTE para hermes_job) — igual a RPC_JOB do TS.
RPC_JOB = frozenset({
    "hermes_plantoes_sobrepostos",
    "hermes_perfis_sem_vinculo",
    "hermes_crm_duplicado",
    "hermes_setores_ocupados_sem_plantao",
    "hermes_porta_resumo",
    "hermes_checkin_pendente",
    "hermes_buracos_escala",
    "hermes_revisoes_paradas",
    "hermes_acessos_anomalos",
    "hermes_cadeia_auditoria",
})

# ── Leituras (as mesmas de lib/db-job.ts) ─────────────────────────────────────
# Todo parâmetro chega como texto e é convertido aqui ($n::text::tipo).
# Listas chegam como JSON (jsonb_array_elements_text).
CONSULTAS: dict[str, str] = {
    "chaves_incidentes_abertos": (
        "select chave_dedup from public.cerbero_incidentes"
        " where status in ('aberto', 'em_analise')"
        " and chave_dedup in (select pg_catalog.jsonb_array_elements_text($1::text::jsonb))"
    ),
    "incidentes_no_periodo": (
        "select id, patrulha, severidade, titulo, status, detectado_em from public.cerbero_incidentes"
        " where detectado_em >= $1::text::timestamptz and detectado_em <= $2::text::timestamptz"
    ),
    "unidades_ativas": "select id, nome from public.unidades where ativo",
    "gestores_da_unidade": (
        "select perfil_id from public.vinculos"
        " where unidade_id = $1::text::uuid and ativo and papel::text in ('gestor', 'admin')"
    ),
    # Só id + nome (é o que o GRANT de coluna permite a hermes_job).
    "nomes_de_perfis": (
        "select id, nome_completo from public.perfis"
        " where id in (select x::uuid from pg_catalog.jsonb_array_elements_text($1::text::jsonb) as x)"
    ),
    "escala_da_unidade": (
        "select id, perfil_id, data, turno from public.escala_plantao"
        " where unidade_id = $1::text::uuid and ativo and data >= $2::text::date and data <= $3::text::date"
    ),
    # Mesmo formato do embed do PostgREST: escala_plantao = { data } ou null.
    "solicitacoes_da_unidade": (
        "select s.perfil_id, s.tipo, s.status, s.destino_perfil_id, s.created_at,"
        " case when e.id is null then null else json_build_object('data', e.data) end as escala_plantao"
        " from public.solicitacoes_escala s"
        " left join public.escala_plantao e on e.id = s.escala_plantao_id"
        " where s.unidade_id = $1::text::uuid and s.created_at >= $2::text::timestamptz"
        " order by s.created_at asc"
    ),
    "trocas_da_unidade": (
        "select perfil_a_id, status, created_at from public.trocas_plantao"
        " where unidade_id = $1::text::uuid and created_at >= $2::text::timestamptz"
    ),
    "alerta_escala_aberto": (
        "select id from public.chronos_alertas_escala"
        " where unidade_id = $1::text::uuid and medico_id = $2::text::uuid"
        " and janela = $3::text and metrica = $4::text and status in ('novo', 'visto')"
        " limit 1"
    ),
    "alertas_no_periodo": (
        "select id, unidade_id, metrica, valor, status, criado_em from public.chronos_alertas_escala"
        " where criado_em >= $1::text::timestamptz and criado_em <= $2::text::timestamptz"
    ),
    "censos_negativos": (
        "select unidade_id, setor_id, data, turno, internados, leitos_total, leitos_ocupados, leitos_livres"
        " from public.censo_ocupacao"
        " where data >= $1::text::date"
        " and (internados < 0 or leitos_total < 0 or leitos_ocupados < 0 or leitos_livres < 0)"
    ),
    "entradas_audit_desde": (
        "select id, phone, tool_result_summary, created_at from public.hermes_audit_log"
        " where direction = 'in' and created_at >= $1::text::timestamptz"
        " order by created_at desc limit $2::text::int"
    ),
    "observacoes_futuras": (
        "select id, unidade_id, aferido_em from public.observacao"
        " where aferido_em > $1::text::timestamptz limit $2::text::int"
    ),
    "prescricoes_futuras": (
        "select id, unidade_id, created_at from public.prescricoes"
        " where created_at > $1::text::timestamptz limit $2::text::int"
    ),
    "prescricoes_orfas": (
        "select id, unidade_id from public.prescricoes where paciente_id is null limit $1::text::int"
    ),
    # ── Comparação sombra × Hermes (compara.py) — só leitura ──────────────────
    # Incidentes dos vigias (chaves 'dados:' e 'hermes:'; o firewall de
    # conteúdo, 'conteudo:', fica fora).
    "cmp_incidentes_dia": (
        "select patrulha, severidade, titulo, chave_dedup, status, detectado_em from public.cerbero_incidentes"
        " where detectado_em >= $1::text::timestamptz and detectado_em < $2::text::timestamptz"
        " and (chave_dedup like 'dados:%' or chave_dedup like 'hermes:%')"
    ),
    "cmp_alertas_dia": (
        "select unidade_id, medico_id, janela, metrica, valor from public.chronos_alertas_escala"
        " where criado_em >= $1::text::timestamptz and criado_em < $2::text::timestamptz"
    ),
    # hermes_job NÃO tem SELECT nestas duas (só INSERT): como hermes_app_job a
    # consulta falha com permissão negada e o compara.py avisa.
    "cmp_notificacoes_dia": (
        "select perfil_id, unidade_id, tipo, data from public.notificacoes_plantonista"
        " where data = $1::text::date"
        " and (tipo in ('sentinela_escala', 'escala_buraco', 'registros_tardios')"
        " or tipo like 'porta_resumo_%' or tipo like 'checkin_pendente_%')"
    ),
    "cmp_relatorios_dia": (
        "select id, periodo_inicio, periodo_fim, resumo, gerado_em from public.gaviao_relatorios_semanais"
        " where gerado_em >= $1::text::timestamptz and gerado_em < $2::text::timestamptz"
    ),
}

# ── Gravações (as mesmas de lib/db-job.ts) ────────────────────────────────────
ESCRITAS: dict[str, str] = {
    # No Postgres, chave já aberta é ignorada (índice parcial).
    "inserir_incidentes": (
        "insert into public.cerbero_incidentes (patrulha, severidade, titulo, evidencia, chave_dedup)"
        " select x.patrulha, x.severidade, x.titulo, x.evidencia, x.chave_dedup"
        " from pg_catalog.jsonb_to_recordset($1::text::jsonb)"
        " as x(patrulha text, severidade text, titulo text, evidencia jsonb, chave_dedup text)"
        " on conflict (chave_dedup) where status in ('aberto', 'em_analise') do nothing"
    ),
    "inserir_alerta_escala": (
        "insert into public.chronos_alertas_escala"
        " (unidade_id, medico_id, janela, metrica, valor, mediana_unidade, limite_outlier, detalhe)"
        " values ($1::text::uuid, $2::text::uuid, $3::text, $4::text, $5::text::numeric,"
        " $6::text::numeric, $7::text::numeric, $8::text::jsonb)"
    ),
    # id gerado no cliente (sem RETURNING): hermes_job não tem SELECT na tabela.
    "inserir_notificacao": (
        "insert into public.notificacoes_plantonista (id, perfil_id, unidade_id, tipo, mensagem, data)"
        " values ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text, $5::text, $6::text::date)"
    ),
    "inserir_relatorio": (
        "insert into public.gaviao_relatorios_semanais (id, periodo_inicio, periodo_fim, resumo, detalhes)"
        " values ($1::text::uuid, $2::text::date, $3::text::date, $4::text::jsonb, $5::text::jsonb)"
    ),
}

_SQL_ASSINATURAS = """
select p.proretset as retset,
       t.typtype::text as tipo_kind,
       t.typname::text as tipo_nome,
       p.pronargdefaults::int as nargdefaults,
       coalesce(p.proargnames, '{}'::text[]) as nomes,
       coalesce(p.proargmodes::text[], '{}'::text[]) as modos,
       array(select pg_catalog.format_type(x.oid, null)
               from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality as x(oid, ord)
              order by x.ord) as tipos
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_type t on t.oid = p.prorettype
 where n.nspname = 'public' and p.proname = $1
"""


class ErroBanco(RuntimeError):
    """Falha ao falar com o banco (mensagem curta, sem dado)."""

    def __init__(self, mensagem: str, codigo: str = ""):
        super().__init__(mensagem)
        self.codigo = codigo


def _numero_json(s: str):
    """Como o JSON.parse do JS: número inteiro vira int (JSON.stringify devolve
    `12`, não `12.0`), o resto float."""
    f = float(s)
    return int(f) if f.is_integer() and abs(f) < 2**53 else f


def carregar_json(texto: str | None):
    return None if texto is None else json.loads(texto, parse_float=_numero_json)


def montar_chamada(nome: str, a: dict, chaves: list[str]) -> str:
    """SQL da chamada de RPC (porte de montarChamada, hermes/src/lib/pg.ts).
    Sempre devolve UMA coluna de texto com o JSON."""
    usadas = [e for e in a["entradas"] if e["nome"] in chaves]
    for e in usadas:
        if not _RE_NOME.match(e["nome"]) or not _RE_TIPO.match(e["tipo"]):
            raise ErroBanco(f"assinatura inesperada em {nome}")
    args = ", ".join(f'"{e["nome"]}" => _a."{e["nome"]}"' for e in usadas)
    chamada = f'public."{nome}"({args})'
    origem = (
        "pg_catalog.jsonb_to_record($1::text::jsonb) as _a(" + ", ".join(f'"{e["nome"]}" {e["tipo"]}' for e in usadas) + ")"
        if usadas else None
    )
    de = f"{origem + ', ' if origem else ''}{chamada} as _f"
    objeto = a["tem_saidas"] or a["tipo_kind"] == "c" or (a["tipo_kind"] == "p" and a["tipo_nome"] == "record")
    if a["retset"] and objeto:
        return f"select coalesce(pg_catalog.json_agg(_r), '[]'::json)::text as r from (select _f.* from {de}) as _r"
    if a["retset"]:
        return f"select coalesce(pg_catalog.json_agg(_f), '[]'::json)::text as r from {de}"
    if a["tipo_kind"] == "p" and a["tipo_nome"] == "void":
        return f"select ({chamada} is null)::text as r" + (f" from {origem}" if origem else "")
    if objeto:
        return f"select pg_catalog.to_json(_r)::text as r from (select _f.* from {de}) as _r"
    return f"select pg_catalog.to_json({chamada})::text as r" + (f" from {origem}" if origem else "")


def _assinatura(linha) -> dict:
    modos = list(linha["modos"] or [])
    nomes = list(linha["nomes"] or [])
    entradas = []
    for i, tipo in enumerate(linha["tipos"]):
        modo = "i" if not modos else modos[i]
        if modo in ("i", "b", "v"):
            entradas.append({"nome": nomes[i] if i < len(nomes) else "", "tipo": tipo})
    return {
        "retset": bool(linha["retset"]),
        "tipo_kind": linha["tipo_kind"],
        "tipo_nome": linha["tipo_nome"],
        "entradas": entradas,
        "obrigatorias": len(entradas) - int(linha["nargdefaults"]),
        "tem_saidas": any(m in ("o", "t", "b") for m in modos),
    }


def _texto_param(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return str(v)


class Banco:
    """Acesso do job. ``ler``/``rpc`` devolvem JSON decodificado; ``escrever`` grava."""

    def __init__(self, url: str, *, somente_leitura: bool, nome_app: str = "coruja-vigias"):
        if not url:
            raise ErroBanco("HERMES_PG_JOB_URL não configurada")
        self._url = url
        self.somente_leitura = somente_leitura
        self._nome_app = nome_app
        self._loop = asyncio.new_event_loop()
        self._conn = None
        self._assinaturas: dict[str, list[dict]] = {}

    # ── infraestrutura ───────────────────────────────────────────────────────
    def _rodar(self, coro):
        try:
            return self._loop.run_until_complete(asyncio.wait_for(coro, _TIMEOUT))
        except ErroBanco:
            raise
        except Exception as e:  # noqa: BLE001 — erro do banco/rede, sem ecoar dado
            codigo = getattr(e, "sqlstate", None) or type(e).__name__
            raise ErroBanco(f"falha no banco ({codigo}): {str(e)[:160]}", str(codigo)) from None

    async def _conexao(self):
        if self._conn is None:
            import asyncpg  # já vem na imagem do Nous

            # statement_cache_size=0: funciona no pooler em modo transaction (6543).
            self._conn = await asyncpg.connect(
                self._url, statement_cache_size=0, command_timeout=_TIMEOUT - 10, timeout=15,
                server_settings={"application_name": self._nome_app},
            )
        return self._conn

    async def _valor(self, sql: str, args: list):
        conn = await self._conexao()
        if self.somente_leitura:
            async with conn.transaction(readonly=True):
                return await conn.fetchval(sql, *args)
        return await conn.fetchval(sql, *args)

    def fechar(self) -> None:
        try:
            if self._conn is not None:
                self._loop.run_until_complete(self._conn.close(timeout=5))
        except Exception:  # noqa: BLE001
            pass
        finally:
            self._conn = None
            self._loop.close()

    # ── leituras fixas ───────────────────────────────────────────────────────
    def ler(self, nome: str, *args) -> list[dict]:
        sql = CONSULTAS.get(nome)
        if sql is None:
            raise ErroBanco(f"consulta fora da lista: {nome}")
        texto = f"select coalesce(pg_catalog.json_agg(_t), '[]'::json)::text from ({sql}) as _t"
        return carregar_json(self._rodar(self._valor(texto, [_texto_param(a) for a in args]))) or []

    # ── RPCs de verificação ──────────────────────────────────────────────────
    async def _ler_assinaturas(self, nome: str) -> list[dict]:
        if nome not in self._assinaturas:
            conn = await self._conexao()
            linhas = await conn.fetch(_SQL_ASSINATURAS, nome)
            self._assinaturas[nome] = [_assinatura(l) for l in linhas]
        return self._assinaturas[nome]

    async def _rpc(self, nome: str, params: dict):
        chaves = [k for k, v in params.items() if v is not None]
        candidatas = [
            a for a in await self._ler_assinaturas(nome)
            if all(k in [e["nome"] for e in a["entradas"]] for k in chaves)
            and all(e["nome"] in chaves for e in a["entradas"][: a["obrigatorias"]])
        ]
        if len(candidatas) != 1:
            raise ErroBanco(f"não achei uma única função public.{nome}({', '.join(chaves)})")
        a = candidatas[0]
        sql = montar_chamada(nome, a, chaves)
        args = [json.dumps({k: params[k] for k in chaves}, ensure_ascii=False)] if chaves else []
        texto = await self._valor(sql, args)
        if a["tipo_kind"] == "p" and a["tipo_nome"] == "void":
            return None
        return carregar_json(texto)

    def rpc(self, nome: str, params: dict | None = None):
        if not isinstance(nome, str) or not _RE_NOME.match(nome) or nome not in RPC_JOB:
            raise ErroBanco(f"função não permitida neste caminho: {str(nome)[:64]}")
        params = params or {}
        if any(not _RE_NOME.match(k) for k in params):
            raise ErroBanco("nome de parâmetro inválido")
        return self._rodar(self._rpc(nome, params))

    # ── gravações fixas ──────────────────────────────────────────────────────
    def escrever(self, nome: str, *args) -> None:
        if self.somente_leitura:
            raise ErroBanco("gravação bloqueada: conexão somente leitura (modo sombra)")
        sql = ESCRITAS.get(nome)
        if sql is None:
            raise ErroBanco(f"gravação fora da lista: {nome}")

        async def _exec():
            conn = await self._conexao()
            await conn.execute(sql, *[_texto_param(a) for a in args])

        self._rodar(_exec())
