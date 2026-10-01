-- Testes dos erros do cliente (migration 20261016000001). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_erros_cliente.sql
-- Registrar erro logado e deslogado; o flood do mesmo erro não duplica; o
-- plantonista/gestor NÃO leem os agrupados (só o super admin); o agrupamento
-- conta ocorrências e perfis distintos; resolver/desmarcar funciona e não apaga.
BEGIN;
-- o Admin de Teste (…0003) vira super admin (administrador geral da plataforma)
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;

-- define o papel do request (sub + role). role 'anon' => deslogado (auth.uid() nulo).
CREATE FUNCTION pg_temp.como(p text, p_role text DEFAULT 'authenticated') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p IS NULL THEN json_build_object('role', p_role)::text
         ELSE json_build_object('sub', p, 'role', p_role)::text END, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text, text) TO authenticated, anon;
-- simula o IP da requisição (x-forwarded-for), para a checagem de flood deslogado
CREATE FUNCTION pg_temp.com_ip(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.headers', json_build_object('x-forwarded-for', p)::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.com_ip(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;

-- ── registrar logado (plantonista …0002): deriva perfil/unidade/papel ───────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'e1', public.registrar_erro_cliente('render', '/plantao/internacao',
  'Cannot read properties of undefined', 'at Comp (chunk.js:1)', 'ASSINA-A', 'Chrome/999', '1.2.3')::text;
-- o mesmo erro, mesmo perfil, dentro de 2 min: flood ignora (devolve NULL)
INSERT INTO t SELECT 'e1_flood', coalesce(public.registrar_erro_cliente('render', '/plantao/internacao',
  'Cannot read properties of undefined', 'outro stack', 'ASSINA-A', 'Chrome/999', '1.2.3')::text, 'NULO');
-- assinatura diferente do mesmo perfil: grava normal
INSERT INTO t SELECT 'e2', public.registrar_erro_cliente('rpc', '/plantao/internacao',
  'permission denied', NULL, 'ASSINA-B', 'Chrome/999', '1.2.3')::text;
-- tipo desconhecido vira 'erro_js'
INSERT INTO t SELECT 'e_tipo', public.registrar_erro_cliente('xpto', '/escala',
  'erro qualquer', NULL, 'ASSINA-C', 'Chrome/999', '1.2.3')::text;
RESET ROLE;

-- ── outro perfil logado (gestor …0001), MESMA assinatura A: não é flood ─────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'e1_outro', public.registrar_erro_cliente('render', '/plantao/internacao',
  'Cannot read properties of undefined', NULL, 'ASSINA-A', 'Firefox/999', '1.2.3')::text;
RESET ROLE;

-- ── registrar DESLOGADO (role anon, sem sub): perfil/unidade nulos ──────────
SET LOCAL ROLE anon;
SELECT pg_temp.como(NULL, 'anon');
SELECT pg_temp.com_ip('203.0.113.9');
INSERT INTO t SELECT 'e_anon', public.registrar_erro_cliente('erro_js', '/login',
  'ReferenceError', NULL, 'ASSINA-D', 'Safari/999', '1.2.3')::text;
-- mesmo ip + mesma assinatura em 2 min: flood ignora
INSERT INTO t SELECT 'e_anon_flood', coalesce(public.registrar_erro_cliente('erro_js', '/login',
  'ReferenceError', NULL, 'ASSINA-D', 'Safari/999', '1.2.3')::text, 'NULO');
RESET ROLE;

-- ── só o super admin lê os agrupados ────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT * FROM public.erros_cliente_agrupados()$$,
  'Acesso negado', 'o plantonista não lê os erros agrupados');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT * FROM public.erros_cliente_agrupados()$$,
  'Acesso negado', 'o gestor não lê os erros agrupados');
SELECT pg_temp.falha($$SELECT public.resolver_erro_cliente('ASSINA-A', true)$$,
  'Acesso negado', 'o gestor não resolve erro');

-- o super admin lê e resolve
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
INSERT INTO t SELECT 'grupos', jsonb_agg(to_jsonb(x))::text FROM public.erros_cliente_agrupados() x;
RESET ROLE;
-- leitura direta da tabela só como superusuário da sessão (o cliente não lê)
INSERT INTO t SELECT 'n_total', count(*)::text FROM public.erros_cliente;

DO $$
DECLARE g jsonb := pg_temp.v('grupos')::jsonb;
DECLARE a jsonb;
BEGIN
  -- registros gravados: e1, e2, e_tipo, e1_outro, e_anon = 5; floods não gravaram
  IF pg_temp.v('e1') IS NULL OR pg_temp.v('e2') IS NULL OR pg_temp.v('e_anon') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: erro logado/deslogado deveria gravar (e1=%, e2=%, e_anon=%)',
      pg_temp.v('e1'), pg_temp.v('e2'), pg_temp.v('e_anon');
  END IF;
  RAISE NOTICE 'OK  registra erro logado e deslogado';
  IF pg_temp.v('e1_flood') <> 'NULO' OR pg_temp.v('e_anon_flood') <> 'NULO' THEN
    RAISE EXCEPTION 'FALHOU: o flood do mesmo erro deveria ser ignorado (perfil=%, ip=%)',
      pg_temp.v('e1_flood'), pg_temp.v('e_anon_flood');
  END IF;
  RAISE NOTICE 'OK  o flood do mesmo erro (mesmo perfil / mesmo ip) não duplica';
  IF pg_temp.v('n_total')::int <> 5 THEN
    RAISE EXCEPTION 'FALHOU: deveriam existir 5 erros gravados, há %', pg_temp.v('n_total');
  END IF;
  RAISE NOTICE 'OK  só as ocorrências reais foram gravadas (5, floods fora)';

  -- grupo da assinatura A: 2 ocorrências (dois perfis), tipo render, origem sem parâmetro
  SELECT x INTO a FROM jsonb_array_elements(g) x WHERE x ->> 'assinatura' = 'ASSINA-A';
  IF a IS NULL OR (a ->> 'ocorrencias')::int <> 2 OR (a ->> 'perfis_afetados')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU: grupo A deveria ter 2 ocorrências e 2 perfis (%)', a;
  END IF;
  RAISE NOTICE 'OK  o agrupamento conta ocorrências e perfis distintos';
  IF a ->> 'tipo' <> 'render' OR a ->> 'origem' <> '/plantao/internacao' OR a ->> 'resolvido' <> 'false' THEN
    RAISE EXCEPTION 'FALHOU: grupo A com tipo/origem/resolvido errados (%)', a;
  END IF;
  RAISE NOTICE 'OK  o grupo traz tipo, origem e um exemplo da mensagem';
  -- tipo desconhecido virou erro_js
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g) x WHERE x ->> 'assinatura' = 'ASSINA-C' AND x ->> 'tipo' = 'erro_js') THEN
    RAISE EXCEPTION 'FALHOU: tipo desconhecido deveria virar erro_js (%)', g;
  END IF;
  RAISE NOTICE 'OK  o servidor normaliza o tipo (desconhecido vira erro_js)';
  -- grupo anon: perfil nulo => 0 perfis afetados
  SELECT x INTO a FROM jsonb_array_elements(g) x WHERE x ->> 'assinatura' = 'ASSINA-D';
  IF a IS NULL OR (a ->> 'perfis_afetados')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: grupo deslogado deveria ter 0 perfis afetados (%)', a;
  END IF;
  RAISE NOTICE 'OK  erro deslogado agrupa sem perfil (perfis_afetados = 0)';
END $$;

-- ── derivação de papel/unidade a partir do token (nunca do front) ───────────
DO $$
DECLARE r public.erros_cliente;
BEGIN
  SELECT * INTO r FROM public.erros_cliente WHERE assinatura = 'ASSINA-B';
  IF r.perfil_id <> '10000000-0000-4000-8000-000000000002'
     OR r.unidade_id <> '21000000-0000-4000-8000-000000000001'
     OR r.papel <> 'plantonista' THEN
    RAISE EXCEPTION 'FALHOU: papel/unidade deveriam vir do vínculo do token (perfil=%, unidade=%, papel=%)',
      r.perfil_id, r.unidade_id, r.papel;
  END IF;
  RAISE NOTICE 'OK  papel/unidade/perfil derivam do token, não do front';
  SELECT * INTO r FROM public.erros_cliente WHERE assinatura = 'ASSINA-D';
  IF r.perfil_id IS NOT NULL OR r.unidade_id IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: erro deslogado deveria ter perfil/unidade nulos (%)', r;
  END IF;
  RAISE NOTICE 'OK  erro deslogado grava sem perfil/unidade';
END $$;

-- ── resolver e desmarcar (não apaga os erros) ───────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.resolver_erro_cliente('ASSINA-A', true);
INSERT INTO t SELECT 'sem_resolv', count(*)::text FROM public.erros_cliente_agrupados();          -- oculta resolvidos
INSERT INTO t SELECT 'com_resolv', count(*)::text FROM public.erros_cliente_agrupados(now() - interval '7 days', true);
INSERT INTO t SELECT 'resolvido_flag', (x.resolvido)::text FROM public.erros_cliente_agrupados(now() - interval '7 days', true) x
  WHERE x.assinatura = 'ASSINA-A';
SELECT public.resolver_erro_cliente('ASSINA-A', false);  -- desmarca
INSERT INTO t SELECT 'desmarcado', (x.resolvido)::text FROM public.erros_cliente_agrupados() x WHERE x.assinatura = 'ASSINA-A';
RESET ROLE;
-- as ocorrências de A continuam na tabela (resolver não apaga)
INSERT INTO t SELECT 'ainda_la', count(*)::text FROM public.erros_cliente WHERE assinatura = 'ASSINA-A';

DO $$
BEGIN
  IF pg_temp.v('sem_resolv')::int <> 3 THEN  -- A oculto; sobram B, C, D (4 grupos - 1)
    RAISE EXCEPTION 'FALHOU: resolvido deveria sair da lista padrão (%)', pg_temp.v('sem_resolv');
  END IF;
  RAISE NOTICE 'OK  resolver tira o grupo da lista padrão';
  IF pg_temp.v('com_resolv')::int <> 4 OR pg_temp.v('resolvido_flag') <> 'true' THEN
    RAISE EXCEPTION 'FALHOU: incluir_resolvidos deveria trazer A marcado (%, flag %)',
      pg_temp.v('com_resolv'), pg_temp.v('resolvido_flag');
  END IF;
  RAISE NOTICE 'OK  incluir_resolvidos traz o grupo marcado como resolvido';
  IF pg_temp.v('ainda_la')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU: resolver NÃO deveria apagar os erros (%)', pg_temp.v('ainda_la');
  END IF;
  RAISE NOTICE 'OK  resolver não apaga os erros (ocorrências continuam)';
  IF pg_temp.v('desmarcado') <> 'false' THEN
    RAISE EXCEPTION 'FALHOU: desmarcar deveria voltar o grupo (%)', pg_temp.v('desmarcado');
  END IF;
  RAISE NOTICE 'OK  desmarcar devolve o grupo à lista';
END $$;

ROLLBACK;
