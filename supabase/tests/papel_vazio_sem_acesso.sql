-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270219000001_papel_vazio_nega_acesso.sql (achado do
-- portão da Fase 5). Tudo em transação com ROLLBACK.
--
-- 1. nenhuma função usa "papel_na_unidade(...) IS NOT NULL" (o papel vazio
--    passava como acesso; barra a volta do padrão em migrations novas);
-- 2. quem não tem vínculo na unidade é recusado nas funções corrigidas;
-- 3. quem tem vínculo continua lendo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(uuid) TO authenticated;
CREATE FUNCTION pg_temp.negado(p_sql text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Acesso negado%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — quem não é da unidade leu', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.negado(text, text) TO authenticated;

-- ── 1. o padrão errado não existe mais ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname IN ('public', 'private') AND p.prosrc ~ 'papel_na_unidade\([^()]*\) IS NOT NULL') THEN
    RAISE EXCEPTION 'FALHOU: há função com "papel_na_unidade(...) IS NOT NULL" (o papel vazio passa como acesso)';
  END IF;
  RAISE NOTICE 'OK  nenhuma função libera pelo papel vazio';
END $$;

-- ── cenário: duas unidades, uma pessoa só na primeira ───────────────────────
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000063b1', 'papel.vazio@teste.local');
INSERT INTO public.perfis (id, nome_completo) VALUES ('00000000-0000-4000-8000-0000000063b1', 'Pessoa do papel vazio')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizacoes (id, nome) VALUES ('00000000-0000-4000-8000-0000000063a1', 'Rede do papel vazio');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('00000000-0000-4000-8000-0000000063a2', '00000000-0000-4000-8000-0000000063a1', 'UBS minha', 'ubs'),
  ('00000000-0000-4000-8000-0000000063a3', '00000000-0000-4000-8000-0000000063a1', 'UBS de outro', 'ubs');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('00000000-0000-4000-8000-0000000063b1', '00000000-0000-4000-8000-0000000063a2', 'plantonista');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('00000000-0000-4000-8000-0000000063b1');

-- ── 2. a outra unidade é recusada ───────────────────────────────────────────
SELECT pg_temp.negado($$SELECT public.pendencias_pep('00000000-0000-4000-8000-0000000063a3')$$, 'pendencias_pep de outra unidade');
SELECT pg_temp.negado($$SELECT public.agenda_dia('00000000-0000-4000-8000-0000000063a3', private.data_atual())$$, 'agenda_dia de outra unidade');
SELECT pg_temp.negado($$SELECT public.agenda_configuracao('00000000-0000-4000-8000-0000000063a3')$$, 'agenda_configuracao de outra unidade');
SELECT pg_temp.negado($$SELECT public.encaminhamentos_upa_origem('00000000-0000-4000-8000-0000000063a3')$$, 'encaminhamentos_upa_origem de outra unidade');
SELECT pg_temp.negado($$SELECT public.contrarreferencias_da_unidade('00000000-0000-4000-8000-0000000063a3')$$, 'contrarreferencias_da_unidade de outra unidade');
SELECT pg_temp.negado($$SELECT public.admissao_detalhes_config('00000000-0000-4000-8000-0000000063a3')$$, 'admissao_detalhes_config de outra unidade');
SELECT pg_temp.negado($$SELECT public.receita_protocolos_da_unidade('00000000-0000-4000-8000-0000000063a3')$$, 'receita_protocolos_da_unidade de outra unidade');

-- ── 3. a própria unidade continua aberta ────────────────────────────────────
SELECT public.contrarreferencias_da_unidade('00000000-0000-4000-8000-0000000063a2');
SELECT public.encaminhamentos_upa_origem('00000000-0000-4000-8000-0000000063a2');
SELECT public.receita_protocolos_da_unidade('00000000-0000-4000-8000-0000000063a2');
DO $$ BEGIN RAISE NOTICE 'OK  a própria unidade continua aberta'; END $$;
RESET ROLE;

ROLLBACK;
