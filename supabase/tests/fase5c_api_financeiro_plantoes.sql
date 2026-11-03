-- Testes da migration 20270120000003_api_financeiro_plantoes.sql (Fase 5C,
-- tarefa 3, etapa 3.3): o ERP busca os plantões fechados pela porta
-- financeiro e responde por versão (conciliada, divergente, estornada), com as
-- mesmas regras das contas; o motivo da reabertura não vai ao ERP; as ações
-- das contas continuam.
-- Não depende da semente local (roda também na homologação). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(uuid) TO authenticated;

INSERT INTO t VALUES ('org', '00000000-0000-4000-8000-0000000e5f01'), ('un', '00000000-0000-4000-8000-0000000e5f02'),
  ('un2', '00000000-0000-4000-8000-0000000e5f05'), ('setor', '00000000-0000-4000-8000-0000000e5f03'),
  ('gestor', '00000000-0000-4000-8000-0000000e5f11'), ('p1', '00000000-0000-4000-8000-0000000e5f12'),
  -- mês passado no horário de Brasília, como nas funções (em UTC falha das 21h às 24h do último dia)
  ('comp', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM')),
  ('dia', (date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month'))::date::text);
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT pg_temp.u(k), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'erp.api.' || k || '.ficticio@exemplo.invalid', '{"origem": "admin"}', jsonb_build_object('nome_completo', 'Ficticio ' || k), now(), now()
  FROM unnest(ARRAY['gestor', 'p1']) k;
INSERT INTO public.perfis (id, nome_completo, cpf, conselho, registro_numero, registro_uf, cbo) VALUES
  (pg_temp.u('gestor'), 'Gestor Ficticio Api', NULL, NULL, NULL, NULL, NULL),
  (pg_temp.u('p1'), 'Medico Ficticio Api', '52998224725', 'CRM', '112233', 'SP', '225125')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, cpf = EXCLUDED.cpf, conselho = EXCLUDED.conselho,
  registro_numero = EXCLUDED.registro_numero, registro_uf = EXCLUDED.registro_uf, cbo = EXCLUDED.cbo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede API Financeiro Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.u('un'), pg_temp.u('org'), 'UPA API Financeiro', 'upa', '9999994'),
  (pg_temp.u('un2'), pg_temp.u('org'), 'UPA API Financeiro Outra', 'upa', '9999995');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.u('setor'), pg_temp.u('un'), 'PS API', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.u('gestor'), pg_temp.u('un'), 'gestor'), (pg_temp.u('p1'), pg_temp.u('un'), 'plantonista') ON CONFLICT DO NOTHING;
INSERT INTO public.remuneracoes_plantao (unidade_id, setor_id, turno, valor) VALUES (pg_temp.u('un'), NULL, NULL, 800);
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('00000000-0000-4000-8000-0000000e5f21', pg_temp.u('un'), pg_temp.u('setor'), pg_temp.u('p1'), pg_temp.v('dia')::date + 4, 'manha',
   (pg_temp.v('dia')::date + 4 + time '07:00') AT TIME ZONE 'America/Sao_Paulo', 360),
  ('00000000-0000-4000-8000-0000000e5f22', pg_temp.u('un'), pg_temp.u('setor'), pg_temp.u('p1'), pg_temp.v('dia')::date + 6, 'manha',
   (pg_temp.v('dia')::date + 6 + time '07:00') AT TIME ZONE 'America/Sao_Paulo', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkout_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio, e.inicio + interval '6 hours'
  FROM public.escala_plantao e WHERE e.id = '00000000-0000-4000-8000-0000000e5f21';

INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, criada_por, expira_em) VALUES
  ('ERP plantões', 'test', 'cc_test_f5f5f5f5', private.api_hash('cc_test_' || repeat('f5', 24)), ARRAY[pg_temp.u('un')],
   ARRAY['financeiro'], pg_temp.u('gestor'), now() + interval '1 month'),
  ('Sem financeiro', 'test', 'cc_test_f6f6f6f6', private.api_hash('cc_test_' || repeat('f6', 24)), ARRAY[pg_temp.u('un')],
   ARRAY['leitos'], pg_temp.u('gestor'), now() + interval '1 month'),
  ('ERP da outra', 'test', 'cc_test_f7f7f7f7', private.api_hash('cc_test_' || repeat('f7', 24)), ARRAY[pg_temp.u('un2')],
   ARRAY['financeiro'], pg_temp.u('gestor'), now() + interval '1 month');
CREATE FUNCTION pg_temp.erp(p_acao text, p_dados jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.api_v1_financeiro('cc_test_' || repeat('f5', 24), '10.0.0.1', 'req-teste', p_acao, p_dados) $$;
CREATE FUNCTION pg_temp.st(r jsonb) RETURNS int LANGUAGE sql AS $$ SELECT (r ->> 'status')::int $$;
CREATE FUNCTION pg_temp.ret(p_versao uuid, p jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.erp('plantoes_retorno', jsonb_build_object('versao_id', p_versao) || p) $$;

-- o gestor fecha o mês
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT public.fechar_plantoes_erp(pg_temp.u('un'), pg_temp.v('comp'));
RESET ROLE;
INSERT INTO t SELECT 'v1', id::text FROM public.plantao_versoes_erp WHERE unidade_id = pg_temp.u('un') AND versao = 1;

-- o ERP busca
DO $$
DECLARE r jsonb := pg_temp.erp('plantoes', jsonb_build_object('unidade_id', pg_temp.u('un'))); x jsonb;
BEGIN
  x := r -> 'corpo' -> 'dados' -> 0;
  IF pg_temp.st(r) <> 200 OR jsonb_array_length(r -> 'corpo' -> 'dados') <> 1 OR x ->> 'id' <> pg_temp.v('v1')
     OR (x ->> 'total')::numeric <> 800 OR x ->> 'competencia' <> pg_temp.v('comp') OR x ->> 'situacao' <> 'vigente'
     OR x ->> 'conciliacao' <> 'pendente' OR x -> 'retorno' <> 'null'::jsonb OR jsonb_array_length(x -> 'plantoes') <> 2
     OR x -> 'plantoes' -> 0 -> 'profissional' ->> 'cpf' <> '52998224725' THEN
    RAISE EXCEPTION 'FALHOU: lista de plantões: %', r;
  END IF;
  IF jsonb_array_length(pg_temp.erp('plantoes', jsonb_build_object('competencia', '200001')) -> 'corpo' -> 'dados') <> 0
     OR jsonb_array_length(pg_temp.erp('plantoes', jsonb_build_object('competencia', pg_temp.v('comp'))) -> 'corpo' -> 'dados') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: filtro por competência';
  END IF;
  IF pg_temp.st(pg_temp.erp('plantoes', jsonb_build_object('unidade_id', pg_temp.u('un2')))) <> 403
     OR pg_temp.st(public.api_v1_financeiro('cc_test_' || repeat('f6', 24), NULL, 'r', 'plantoes', '{}')) <> 403
     OR jsonb_array_length(public.api_v1_financeiro('cc_test_' || repeat('f7', 24), NULL, 'r', 'plantoes', '{}') -> 'corpo' -> 'dados') <> 0
     OR pg_temp.st(public.api_v1_financeiro('cc_test_' || repeat('f7', 24), NULL, 'r', 'plantoes_retorno',
                   jsonb_build_object('versao_id', pg_temp.u('v1'), 'acao', 'lancada', 'erp_id', 'X', 'valor_lancado', 1))) <> 404 THEN
    RAISE EXCEPTION 'FALHOU: escopo da chave nos plantões';
  END IF;
  IF pg_temp.st(pg_temp.erp('contas', '{}')) <> 200 THEN RAISE EXCEPTION 'FALHOU: a ação contas parou'; END IF;
  RAISE NOTICE 'OK  o ERP busca os plantões fechados das unidades da chave, com filtro por competência; contas seguem';
END $$;

-- retorno: validação, divergente, conciliada, reenvio, estorno só da substituída
DO $$
DECLARE r jsonb; v uuid := pg_temp.u('v1');
BEGIN
  IF pg_temp.st(pg_temp.ret(v, '{"acao": "lancada", "valor_lancado": 800}')) <> 400
     OR pg_temp.st(pg_temp.ret(v, '{"acao": "lancada", "erp_id": "FP-1"}')) <> 400
     OR pg_temp.st(pg_temp.ret(v, '{"acao": "paga", "erp_id": "FP-1"}')) <> 400
     OR pg_temp.st(pg_temp.ret(gen_random_uuid(), '{"acao": "lancada", "erp_id": "FP-1", "valor_lancado": 1}')) <> 404
     OR pg_temp.st(pg_temp.erp('plantoes_retorno', '{"versao_id": "nao-uuid", "acao": "lancada"}')) <> 400 THEN
    RAISE EXCEPTION 'FALHOU: validação do retorno dos plantões';
  END IF;
  r := pg_temp.ret(v, '{"acao": "lancada", "erp_id": "FP-1", "valor_lancado": 750}');
  IF pg_temp.st(r) <> 200 OR r -> 'corpo' ->> 'conciliacao' <> 'divergente' THEN RAISE EXCEPTION 'FALHOU: divergente: %', r; END IF;
  r := pg_temp.ret(v, '{"acao": "lancada", "erp_id": "FP-1", "valor_lancado": 800}');
  IF r -> 'corpo' ->> 'conciliacao' <> 'conciliada' THEN RAISE EXCEPTION 'FALHOU: conciliada: %', r; END IF;
  PERFORM pg_temp.ret(v, '{"acao": "lancada", "erp_id": "FP-1", "valor_lancado": "800.00"}');
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade_id = v AND acao IN ('plantoes_erp_conciliada', 'plantoes_erp_divergente')) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: reenvio igual repetiu a auditoria';
  END IF;
  IF pg_temp.st(pg_temp.ret(v, '{"acao": "estornada"}')) <> 409 THEN RAISE EXCEPTION 'FALHOU: estorno da vigente'; END IF;
  RAISE NOTICE 'OK  retorno: divergente, corrigido para conciliada; reenvio igual não repete; vigente não se estorna';
END $$;

-- o gestor reabre: a versão substituída não se lança, se estorna; o motivo não vai ao ERP
SET LOCAL ROLE authenticated;
SELECT pg_temp.como(pg_temp.u('gestor'));
SELECT public.reabrir_plantoes_erp(pg_temp.u('un'), pg_temp.v('comp'), 'texto livre da reabertura do mês');
RESET ROLE;
DO $$
DECLARE r jsonb; v uuid := pg_temp.u('v1');
BEGIN
  IF pg_temp.st(pg_temp.ret(v, '{"acao": "lancada", "erp_id": "FP-2", "valor_lancado": 800}')) <> 409 THEN
    RAISE EXCEPTION 'FALHOU: lançar versão substituída';
  END IF;
  r := pg_temp.ret(v, '{"acao": "estornada"}');
  IF pg_temp.st(r) <> 200 OR r -> 'corpo' ->> 'conciliacao' <> 'estornada' OR r -> 'corpo' ->> 'erp_id' <> 'FP-1'
     OR (r -> 'corpo' ->> 'valor_lancado')::numeric <> 800 THEN
    RAISE EXCEPTION 'FALHOU: estorno: %', r;
  END IF;
  PERFORM pg_temp.ret(v, '{"acao": "estornada"}');
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade_id = v AND acao = 'plantoes_erp_estornada') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: estorno repetido';
  END IF;
  r := pg_temp.erp('plantoes', '{}');
  IF r::text LIKE '%texto livre da reabertura%' OR r -> 'corpo' -> 'dados' -> 0 ->> 'situacao' <> 'substituida' THEN
    RAISE EXCEPTION 'FALHOU: versão substituída na lista: %', r;
  END IF;
  RAISE NOTICE 'OK  reaberto o mês: substituída não se lança, o ERP estorna uma vez; o motivo não vai ao ERP';
END $$;

-- registro das chamadas e privilégios
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
                  WHERE k.prefixo = 'cc_test_f5f5f5f5' AND a.recurso = 'financeiro_plantoes_retorno' AND a.status = 409)
     OR NOT EXISTS (SELECT 1 FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
                     WHERE k.prefixo = 'cc_test_f5f5f5f5' AND a.recurso = 'financeiro_plantoes' AND a.status = 200)
     OR has_function_privilege('authenticated', 'public.api_v1_financeiro(text, text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.erp_plantao_versao_json(public.plantao_versoes_erp)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: registro de chamadas ou privilégios';
  END IF;
  RAISE NOTICE 'OK  cada chamada fica registrada; porta só para a Edge Function';
END $$;
ROLLBACK;
