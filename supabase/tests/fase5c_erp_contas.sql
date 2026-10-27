-- Testes da migration 20270120000001_erp_contas.sql (Fase 5C, tarefa 3,
-- subtarefa 1): a conta faturada vira a versão 1 para o ERP, com itens,
-- medicamentos e total do que vai ao SUS, sem dado do paciente além do
-- prontuário; o ERP busca pela porta com o recurso "financeiro"; o retorno
-- concilia ou acusa divergência; reenvio igual não repete; glosa devolve a
-- versão à lista; reabrir substitui a versão, o ERP estorna e o faturamento
-- seguinte gera a versão 2.
-- Não depende da semente local: cria unidade, paciente e atendimento fictícios
-- (roda também na homologação). ROLLBACK no fim.
BEGIN;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text);
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;

INSERT INTO t VALUES ('perfil', (SELECT id::text FROM public.perfis ORDER BY id LIMIT 1)),
  ('org', '00000000-0000-4000-8000-0000000e5c01'), ('un', '00000000-0000-4000-8000-0000000e5c02'),
  ('un2', '00000000-0000-4000-8000-0000000e5c03'), ('setor', '00000000-0000-4000-8000-0000000e5c04'),
  ('pac', '00000000-0000-4000-8000-0000000e5c05'), ('epi', '00000000-0000-4000-8000-0000000e5c06');
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.u('org'), 'Rede ERP Teste');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes) VALUES
  (pg_temp.u('un'), pg_temp.u('org'), 'UPA ERP Teste', 'upa', '9999991'),
  (pg_temp.u('un2'), pg_temp.u('org'), 'UPA ERP Outra', 'upa', '9999992');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.u('setor'), pg_temp.u('un'), 'PS ERP', 'emergencia');
INSERT INTO public.pacientes (id, unidade_id, nome, cpf, data_nascimento, prontuario, sexo)
VALUES (pg_temp.u('pac'), pg_temp.u('un'), 'Paciente Ficticio Erp', '52998224725', '1980-01-01', 'ERP-0001', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, chegada_em)
VALUES (pg_temp.u('epi'), pg_temp.u('un'), pg_temp.u('pac'), pg_temp.u('setor'), 'Teste ERP', pg_temp.u('perfil'), '2026-10-05 09:00-03');
INSERT INTO t SELECT 'conta', id::text FROM public.contas WHERE episodio_id = pg_temp.u('epi');

-- chaves: ERP (financeiro), outra sem financeiro, ERP de outra unidade
INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, criada_por, expira_em) VALUES
  ('ERP de teste', 'test', 'cc_test_e5e5e5e5', private.api_hash('cc_test_' || repeat('e5', 24)), ARRAY[pg_temp.u('un')],
   ARRAY['financeiro'], pg_temp.u('perfil'), now() + interval '1 month'),
  ('Painel de teste', 'test', 'cc_test_e6e6e6e6', private.api_hash('cc_test_' || repeat('e6', 24)), ARRAY[pg_temp.u('un')],
   ARRAY['producao'], pg_temp.u('perfil'), now() + interval '1 month'),
  ('ERP da outra', 'test', 'cc_test_e7e7e7e7', private.api_hash('cc_test_' || repeat('e7', 24)), ARRAY[pg_temp.u('un2')],
   ARRAY['financeiro'], pg_temp.u('perfil'), now() + interval '1 month');
CREATE FUNCTION pg_temp.erp(p_acao text, p_dados jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.api_v1_financeiro('cc_test_' || repeat('e5', 24), '10.0.0.1', 'req-teste', p_acao, p_dados) $$;
CREATE FUNCTION pg_temp.st(r jsonb) RETURNS int LANGUAGE sql AS $$ SELECT (r ->> 'status')::int $$;
CREATE FUNCTION pg_temp.eventos(p_evento text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.conta_eventos WHERE conta_id = (SELECT valor::uuid FROM t WHERE nome = 'conta') AND evento = p_evento $$;

-- conta fechada (itens e medicamentos guardados) e depois faturada
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'alta', desfecho_em = '2026-10-05 12:00-03', encerrado_em = '2026-10-05 12:00-03'
 WHERE id = pg_temp.u('epi');
UPDATE public.contas SET status = 'em_conferencia' WHERE id = pg_temp.u('conta');
UPDATE public.contas SET status = 'fechada', congelada_em = now(),
  itens_congelados = '[
    {"origem": "atendimento", "procedimento": "0301060029", "nome": "ATENDIMENTO DE URGENCIA", "quantidade": 1, "em": "2026-10-05T10:00:00-03:00",
     "valor_unitario": 11.00, "valor_total": 11.00, "destino": "bpa_i", "profissional": "Dra. Ficticia", "cbo": "225125", "criticas": []},
    {"origem": "registro", "procedimento": "0214010015", "nome": "GLICEMIA CAPILAR", "quantidade": 2, "em": "2026-10-05T10:30:00-03:00",
     "valor_unitario": 1.37, "valor_total": 2.74, "destino": "bpa_c", "profissional": "Enf. Ficticia", "cbo": "223505", "criticas": []},
    {"origem": "registro", "procedimento": "0204030153", "nome": "RADIOGRAFIA DE TORAX", "quantidade": 1, "em": "2026-10-05T11:00:00-03:00",
     "valor_unitario": 10.50, "valor_total": 10.50, "destino": "fora", "profissional": "Dra. Ficticia", "cbo": "225125", "criticas": [{"codigo": "x"}]}
  ]'::jsonb,
  medicamentos_congelados = '[
    {"item_id": "00000000-0000-4000-8000-0000000e5c99", "medicamento": "Dipirona 500 mg/mL", "unidade_consumo": "ampola",
     "prescricao": "1 g · EV · agora", "dispensado": 2, "devolvido": 1, "liquido": 1, "administrado": 1,
     "aviso": null, "fora_da_conta": false, "fora_motivo": null, "fora_por": null}
  ]'::jsonb
 WHERE id = pg_temp.u('conta');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.conta_versoes_erp WHERE conta_id = pg_temp.u('conta')) THEN
    RAISE EXCEPTION 'FALHOU: conta fechada (ainda não faturada) já tem versão';
  END IF;
  RAISE NOTICE 'OK  conta fechada ainda não vai ao ERP';
END $$;
UPDATE public.contas SET status = 'faturada', status_em = now() WHERE id = pg_temp.u('conta');

-- 2a/5a. versão 1, com o total do que vai ao SUS
DO $$
DECLARE v public.conta_versoes_erp; d jsonb;
BEGIN
  SELECT * INTO v FROM public.conta_versoes_erp WHERE conta_id = pg_temp.u('conta');
  d := v.dados;
  IF v.versao <> 1 OR v.situacao <> 'vigente' OR v.conciliacao <> 'pendente' OR v.total <> 13.74 THEN
    RAISE EXCEPTION 'FALHOU: versão 1: % % % %', v.versao, v.situacao, v.conciliacao, v.total;
  END IF;
  IF (d ->> 'total_referencia')::numeric <> 24.24 OR jsonb_array_length(d -> 'itens') <> 3
     OR (SELECT count(*) FROM jsonb_array_elements(d -> 'itens') x WHERE NOT (x ->> 'faturavel')::boolean) <> 1
     OR d -> 'itens' -> 0 ->> 'competencia' <> '202610' OR d ->> 'prontuario' <> 'ERP-0001'
     OR d -> 'unidade' ->> 'cnes' <> '9999991' THEN
    RAISE EXCEPTION 'FALHOU: dados da versão: %', d;
  END IF;
  IF d -> 'medicamentos' -> 0 ->> 'medicamento' <> 'Dipirona 500 mg/mL' OR (d -> 'medicamentos' -> 0 ->> 'liquido')::int <> 1
     OR d -> 'medicamentos' -> 0 ? 'prescricao' THEN
    RAISE EXCEPTION 'FALHOU: medicamentos na versão: %', d -> 'medicamentos';
  END IF;
  IF d::text ILIKE '%Ficticio Erp%' OR d::text LIKE '%52998224725%' OR d::text ILIKE '%Ficticia%' OR d -> 'itens' -> 0 ? 'cbo' THEN
    RAISE EXCEPTION 'FALHOU: dado de pessoa na versão';
  END IF;
  IF pg_temp.eventos('erp_disponivel') <> 1 THEN RAISE EXCEPTION 'FALHOU: evento erp_disponivel'; END IF;
  RAISE NOTICE 'OK  2a/5a: faturada gera a versão 1; total só do que vai ao SUS; medicamentos sem prescrição; só o prontuário do paciente';
END $$;

-- 1a. o ERP busca; escopo da chave
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.erp('contas', jsonb_build_object('unidade_id', pg_temp.u('un')));
  IF pg_temp.st(r) <> 200 OR jsonb_array_length(r -> 'corpo' -> 'dados') <> 1
     OR (r -> 'corpo' -> 'dados' -> 0 ->> 'versao')::int <> 1 OR (r -> 'corpo' -> 'dados' -> 0 ->> 'total')::numeric <> 13.74
     OR r -> 'corpo' -> 'dados' -> 0 -> 'retorno' <> 'null'::jsonb OR jsonb_array_length(r -> 'corpo' -> 'dados' -> 0 -> 'glosas') <> 0 THEN
    RAISE EXCEPTION 'FALHOU: lista do ERP: %', r;
  END IF;
  IF jsonb_array_length(pg_temp.erp('contas', '{}') -> 'corpo' -> 'dados') <> 1 THEN RAISE EXCEPTION 'FALHOU: sem unidade_id, as unidades da chave'; END IF;
  IF pg_temp.st(pg_temp.erp('contas', jsonb_build_object('unidade_id', pg_temp.u('un2')))) <> 403 THEN RAISE EXCEPTION 'FALHOU: unidade fora da chave'; END IF;
  IF pg_temp.st(public.api_v1_financeiro('cc_test_' || repeat('e6', 24), NULL, 'r', 'contas', '{}')) <> 403 THEN RAISE EXCEPTION 'FALHOU: chave sem financeiro'; END IF;
  IF pg_temp.st(public.api_v1_financeiro('cc_test_' || repeat('e7', 24), NULL, 'r', 'conta', jsonb_build_object('conta_id', pg_temp.u('conta')))) <> 404
     OR jsonb_array_length(public.api_v1_financeiro('cc_test_' || repeat('e7', 24), NULL, 'r', 'contas', '{}') -> 'corpo' -> 'dados') <> 0 THEN
    RAISE EXCEPTION 'FALHOU: ERP de outra unidade vê a conta';
  END IF;
  IF pg_temp.st(public.api_v1_financeiro('cc_test_nao_existe', NULL, 'r', 'contas', '{}')) <> 401 THEN RAISE EXCEPTION 'FALHOU: chave inexistente'; END IF;
  IF pg_temp.st(pg_temp.erp('qualquer', '{}')) <> 404 THEN RAISE EXCEPTION 'FALHOU: ação inexistente'; END IF;
  RAISE NOTICE 'OK  1a: o ERP busca as versões das unidades da chave; outra chave e outra unidade não veem';
END $$;

-- 4a. retorno: divergente, correção para conciliada, reenvio igual
DO $$
DECLARE r jsonb; c uuid := pg_temp.u('conta');
BEGIN
  IF pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'lancada', 'valor_lancado', 13.74))) <> 400
     OR pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'lancada', 'erp_id', 'NF-1'))) <> 400
     OR pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'paga', 'erp_id', 'NF-1'))) <> 400
     OR pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 'um', 'acao', 'lancada'))) <> 400
     OR pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 9, 'acao', 'lancada', 'erp_id', 'NF-1', 'valor_lancado', 1))) <> 404
     OR pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'lancada', 'erp_id', 'NF-1', 'valor_lancado', 1,
                                                       'recebida_em', now() + interval '1 day'))) <> 400 THEN
    RAISE EXCEPTION 'FALHOU: validação do retorno';
  END IF;
  r := pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'lancada', 'erp_id', 'NF-1', 'valor_lancado', 13.00));
  IF pg_temp.st(r) <> 200 OR r -> 'corpo' ->> 'conciliacao' <> 'divergente' THEN RAISE EXCEPTION 'FALHOU: divergente: %', r; END IF;
  r := pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'lancada', 'erp_id', 'NF-1', 'valor_lancado', 13.74));
  IF r -> 'corpo' ->> 'conciliacao' <> 'conciliada' THEN RAISE EXCEPTION 'FALHOU: conciliada: %', r; END IF;
  r := pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'lancada', 'erp_id', 'NF-1', 'valor_lancado', '13.740'));
  IF pg_temp.st(r) <> 200 OR pg_temp.eventos('erp_conciliada') <> 1 OR pg_temp.eventos('erp_divergente') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: reenvio igual repetiu o evento';
  END IF;
  IF pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'estornada'))) <> 409 THEN
    RAISE EXCEPTION 'FALHOU: estorno da versão vigente';
  END IF;
  IF (SELECT status FROM public.contas WHERE id = c) <> 'faturada' THEN RAISE EXCEPTION 'FALHOU: o retorno mudou a conta'; END IF;
  RAISE NOTICE 'OK  4a: divergente, corrigida para conciliada; reenvio igual não repete; vigente não se estorna; a conta não muda';
END $$;

-- glosa: a versão vigente volta para a lista do ERP, com a glosa
UPDATE public.conta_versoes_erp SET alterada_em = now() - interval '1 hour' WHERE conta_id = pg_temp.u('conta');
INSERT INTO public.conta_glosas (conta_id, unidade_id, item_rotulo, competencia, valor, motivo_codigo, motivo_texto, registrada_por)
VALUES (pg_temp.u('conta'), pg_temp.u('un'), 'Conta inteira', '202610', 2.74, 'outro', 'texto livre que não vai ao ERP', pg_temp.u('perfil'));
DO $$
DECLARE r jsonb := pg_temp.erp('contas', jsonb_build_object('desde', now() - interval '1 minute'));
BEGIN
  IF jsonb_array_length(r -> 'corpo' -> 'dados') <> 1 OR jsonb_array_length(r -> 'corpo' -> 'dados' -> 0 -> 'glosas') <> 1
     OR (r -> 'corpo' -> 'dados' -> 0 -> 'glosas' -> 0 ->> 'valor')::numeric <> 2.74
     OR r::text LIKE '%texto livre%' THEN
    RAISE EXCEPTION 'FALHOU: glosa na versão: %', r;
  END IF;
  RAISE NOTICE 'OK  2a: glosa nova devolve a versão à lista do ERP, sem o texto livre do motivo';
END $$;

-- 5a. reabrir substitui; o ERP estorna; o faturamento seguinte gera a versão 2
UPDATE public.contas SET status = 'aberta', status_em = now() WHERE id = pg_temp.u('conta');
DO $$
DECLARE r jsonb; c uuid := pg_temp.u('conta');
BEGIN
  IF (SELECT situacao FROM public.conta_versoes_erp WHERE conta_id = c AND versao = 1) <> 'substituida' OR pg_temp.eventos('erp_substituida') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: reabrir substitui a versão';
  END IF;
  IF pg_temp.st(pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'lancada', 'erp_id', 'NF-2', 'valor_lancado', 1))) <> 409 THEN
    RAISE EXCEPTION 'FALHOU: lançar versão substituída';
  END IF;
  r := pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'estornada'));
  IF pg_temp.st(r) <> 200 OR r -> 'corpo' ->> 'conciliacao' <> 'estornada' OR r -> 'corpo' ->> 'erp_id' <> 'NF-1' THEN RAISE EXCEPTION 'FALHOU: estorno: %', r; END IF;
  PERFORM pg_temp.erp('retorno', jsonb_build_object('conta_id', c, 'versao', 1, 'acao', 'estornada'));
  IF pg_temp.eventos('erp_estornada') <> 1 THEN RAISE EXCEPTION 'FALHOU: estorno repetido'; END IF;
  RAISE NOTICE 'OK  5a: reabrir substitui a versão; substituída não se lança; o ERP estorna uma vez';
END $$;
UPDATE public.contas SET status = 'fechada' WHERE id = pg_temp.u('conta');
UPDATE public.contas SET status = 'faturada', status_em = now() WHERE id = pg_temp.u('conta');
DO $$
DECLARE r jsonb := pg_temp.erp('conta', jsonb_build_object('conta_id', pg_temp.u('conta')));
BEGIN
  IF pg_temp.st(r) <> 200 OR jsonb_array_length(r -> 'corpo' -> 'dados') <> 2
     OR r -> 'corpo' -> 'dados' -> 0 ->> 'situacao' <> 'substituida' OR r -> 'corpo' -> 'dados' -> 0 ->> 'conciliacao' <> 'estornada'
     OR r -> 'corpo' -> 'dados' -> 1 ->> 'situacao' <> 'vigente' OR (r -> 'corpo' -> 'dados' -> 1 ->> 'versao')::int <> 2
     OR r -> 'corpo' -> 'dados' -> 1 ->> 'conciliacao' <> 'pendente' THEN
    RAISE EXCEPTION 'FALHOU: versão 2: %', r;
  END IF;
  IF (SELECT count(*) FROM public.conta_versoes_erp WHERE conta_id = pg_temp.u('conta') AND situacao = 'vigente') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: mais de uma versão vigente';
  END IF;
  RAISE NOTICE 'OK  5a: o faturamento seguinte gera a versão 2; a 1 fica como histórico';
END $$;

-- registro, guarda e privilégios
SELECT pg_temp.falha(format('DELETE FROM public.conta_versoes_erp WHERE conta_id = %L', pg_temp.u('conta')), '', 'versão não se apaga');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
                  WHERE k.prefixo = 'cc_test_e5e5e5e5' AND a.recurso = 'financeiro_retorno' AND a.status = 409)
     OR NOT EXISTS (SELECT 1 FROM public.api_acessos a JOIN public.api_chaves k ON k.id = a.chave_id
                     WHERE k.prefixo = 'cc_test_e5e5e5e5' AND a.recurso = 'financeiro_contas' AND a.status = 200 AND a.unidade_id = pg_temp.u('un'))
     OR NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade_id = pg_temp.u('conta') AND acao = 'conta_erp_conciliada')
     OR has_function_privilege('authenticated', 'public.api_v1_financeiro(text, text, text, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.api_v1_financeiro(text, text, text, text, jsonb)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.conta_versoes_erp', 'INSERT')
     OR has_table_privilege('authenticated', 'public.conta_versoes_erp', 'UPDATE')
     OR has_table_privilege('anon', 'public.conta_versoes_erp', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: registro de chamadas, auditoria ou privilégios';
  END IF;
  RAISE NOTICE 'OK  cada chamada e cada retorno ficam registrados; porta só para a Edge Function; versões só pelos gatilhos';
END $$;
SELECT pg_temp.falha($$INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, criada_por, expira_em)
  VALUES ('x', 'test', 'cc_test_x', 'x', ARRAY[gen_random_uuid()], ARRAY['folha'], gen_random_uuid(), now() + interval '1 day')$$,
  'new row for relation "api_chaves" violates check constraint', 'recurso fora da lista recusado');
ROLLBACK;
