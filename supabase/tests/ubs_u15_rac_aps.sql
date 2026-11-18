-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000021_ubs_u15_rac_aps.sql (percurso da UBS, U15,
-- PR 1). Tudo em transação com ROLLBACK; o cenário é o mesmo do teste dos
-- indicadores da APS, criado aqui, com uma UPA ao lado.
--
-- 1. o RAC da UBS sai com a modalidade 01; a consulta programada é eletiva
--    (01) e a consulta no dia, 02; na UPA nada muda (06 e 02);
-- 2. a ficha que venceu na UBS não entra na fila;
-- 3. com a RNDS da APS pelo PEC, a fila da UBS é descartada e o RAC novo não
--    entra; a UPA não muda;
-- 4. só o gestor da UBS escolhe, e só na UBS.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000098a1'), ('ubs', '00000000-0000-4000-8000-0000000098a2'),
  ('cons', '00000000-0000-4000-8000-0000000098a3'),
  ('ges', '00000000-0000-4000-8000-0000000098b1'), ('med', '00000000-0000-4000-8000-0000000098b2'),
  ('enf', '00000000-0000-4000-8000-0000000098b3'), ('rec', '00000000-0000-4000-8000-0000000098b4'),
  ('idoso', '00000000-0000-4000-8000-0000000098c1'), ('m30', '00000000-0000-4000-8000-0000000098c2'),
  ('m55', '00000000-0000-4000-8000-0000000098c3'), ('h40', '00000000-0000-4000-8000-0000000098c4');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE r (j jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15a.local' FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'), (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'), (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao');
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento) VALUES
  (pg_temp.id('idoso'), pg_temp.id('ubs'), 'Idoso U13', 'U13-1', 'M', private.data_atual() - interval '70 years'),
  (pg_temp.id('m30'), pg_temp.id('ubs'), 'Mulher Trinta', 'U13-2', 'F', private.data_atual() - interval '30 years'),
  (pg_temp.id('m55'), pg_temp.id('ubs'), 'Mulher Cinquenta', 'U13-3', 'F', private.data_atual() - interval '55 years'),
  (pg_temp.id('h40'), pg_temp.id('ubs'), 'Homem Quarenta', 'U13-4', 'M', private.data_atual() - interval '40 years');

-- consultas encerradas: idoso programada (médico); m30 agendada com saúde sexual (enfermeiro);
-- h40 consulta no dia (médico) e escuta (enfermeiro); m55 ficha vencida (sem profissional)
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, tipo_atendimento_aps,
                              desfecho_por, encerrado_por, encerrado_em, conduta_aps, problemas_aps)
VALUES
  (pg_temp.id('ubs'), pg_temp.id('idoso'), pg_temp.id('cons'), 'Retorno', pg_temp.id('rec'), 'encerrado', 'consulta_programada',
   pg_temp.id('med'), pg_temp.id('med'), now() - interval '10 days', '{retorno_cuidado_continuado}', '{hipertensao_arterial}'),
  (pg_temp.id('ubs'), pg_temp.id('m30'), pg_temp.id('cons'), 'Planejamento', pg_temp.id('rec'), 'encerrado', 'consulta_agendada',
   pg_temp.id('enf'), pg_temp.id('enf'), now() - interval '20 days', '{alta_episodio}', '{saude_sexual_reprodutiva}'),
  (pg_temp.id('ubs'), pg_temp.id('h40'), pg_temp.id('cons'), 'Dor', pg_temp.id('rec'), 'encerrado', 'consulta_no_dia',
   pg_temp.id('med'), pg_temp.id('med'), now() - interval '5 days', '{alta_episodio}', '{}'),
  (pg_temp.id('ubs'), pg_temp.id('h40'), pg_temp.id('cons'), 'Orientação', pg_temp.id('rec'), 'encerrado', 'escuta_inicial',
   pg_temp.id('enf'), pg_temp.id('enf'), now() - interval '4 days', NULL, '{}'),
  (pg_temp.id('ubs'), pg_temp.id('m55'), pg_temp.id('cons'), 'Ficha que venceu', pg_temp.id('rec'), 'encerrado', 'consulta_no_dia',
   NULL, NULL, now() - interval '3 days', NULL, '{}');

-- peso e altura do idoso no mesmo dia
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, aferido_em, origem)
SELECT pg_temp.id('ubs'), pg_temp.id('idoso'), c.id, v, now() - interval '10 days', 'manual'
  FROM public.conceito c JOIN (VALUES ('peso', 70), ('estatura', 170)) x(n, v) ON x.n = c.nome;

-- preventivo da m30 e mamografia da m55
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, exame, procedimento, pedido_por, pedido_em) VALUES
  (pg_temp.id('ubs'), pg_temp.id('m30'), 'Citopatológico', '0203010086', pg_temp.id('enf'), now() - interval '100 days'),
  (pg_temp.id('ubs'), pg_temp.id('m55'), 'Mamografia', '0204030188', pg_temp.id('med'), now() - interval '200 days');

-- uma UPA ao lado, com um atendimento encerrado
INSERT INTO ids VALUES ('upa', '00000000-0000-4000-8000-0000000098d1'), ('upa_set', '00000000-0000-4000-8000-0000000098d2'),
  ('upa_pac', '00000000-0000-4000-8000-0000000098d3');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U15', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('upa_set'), pg_temp.id('upa'), 'Consultório UPA', 'consultorio');
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento)
VALUES (pg_temp.id('upa_pac'), pg_temp.id('upa'), 'Paciente UPA', 'U15-9', 'M', private.data_atual() - interval '33 years');
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, desfecho, desfecho_em, encerrado_em)
VALUES (pg_temp.id('upa'), pg_temp.id('upa_pac'), pg_temp.id('upa_set'), 'Dor', pg_temp.id('rec'), 'encerrado', 'alta',
        now() - interval '1 day', now() - interval '1 day');
INSERT INTO public.rnds_config_unidade (unidade_id, financiamento) VALUES (pg_temp.id('ubs'), '07'), (pg_temp.id('upa'), '07');

-- desfechos: alta no idoso (programada) e no h40 (no dia); a ficha da m55 venceu
UPDATE public.episodios SET desfecho = 'alta', desfecho_em = encerrado_em
 WHERE paciente_id IN (pg_temp.id('idoso'), pg_temp.id('h40'));
UPDATE public.episodios SET desfecho = 'evasao', desfecho_em = encerrado_em, desfecho_detalhes = '{"vencida": true}'
 WHERE paciente_id = pg_temp.id('m55');

CREATE FUNCTION pg_temp.ep(p text, p_tipo text DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.episodios WHERE paciente_id = pg_temp.id(p) AND (p_tipo IS NULL OR tipo_atendimento_aps = p_tipo) LIMIT 1 $$;
CREATE FUNCTION pg_temp.enfileirar(p text, p_tipo text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  SELECT private.enfileirar_documento(e.unidade_id, 'rac', e.id,
           jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'rac', 'episodio_id', e.id))
    FROM public.episodios e WHERE e.id = pg_temp.ep(p, p_tipo) $$;
CREATE FUNCTION pg_temp.na_fila(p text, p_tipo text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(status, ','), 'nada') FROM public.interop_outbox
   WHERE tipo_documento = 'rac' AND referencia_id = pg_temp.ep(p, p_tipo) $$;

SELECT pg_temp.ok((SELECT private.rnds_carga_rac(pg_temp.ep('idoso')) -> 'contato' @> '{"modalidade": "01", "carater": "01"}'),
  '1. RAC da UBS: Atenção Básica (01), consulta programada eletiva (01)');
SELECT pg_temp.ok((SELECT private.rnds_carga_rac(pg_temp.ep('h40', 'consulta_no_dia')) -> 'contato' @> '{"modalidade": "01", "carater": "02"}'),
  '1. RAC da UBS: consulta no dia com caráter 02');
SELECT pg_temp.ok((SELECT private.rnds_carga_rac(pg_temp.ep('upa_pac')) -> 'contato' @> '{"modalidade": "06", "carater": "02"}'),
  '1. RAC da UPA: segue 06 e 02');

SELECT pg_temp.enfileirar('idoso'); SELECT pg_temp.enfileirar('m55'); SELECT pg_temp.enfileirar('upa_pac');
SELECT pg_temp.ok(pg_temp.na_fila('idoso') = 'pendente' AND pg_temp.na_fila('upa_pac') = 'pendente', '2. o RAC da consulta entra na fila');
SELECT pg_temp.ok(pg_temp.na_fila('m55') = 'nada', '2. a ficha que venceu na UBS não entra na fila');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
DO $$ BEGIN
  PERFORM public.rnds_rac_aps_pelo(pg_temp.id('ubs'), 'pec');
  RAISE EXCEPTION 'FALHOU: 4. o enfermeiro escolhe — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  4. só o gestor escolhe por onde vai a RNDS da APS';
END $$;
SELECT pg_temp.como('ges');
DO $$ BEGIN
  PERFORM public.rnds_rac_aps_pelo(pg_temp.id('ubs'), 'outro');
  RAISE EXCEPTION 'FALHOU: 4. valor fora da lista — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Escolha:%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  4. só app ou pec';
END $$;
INSERT INTO r SELECT to_jsonb(public.rnds_rac_aps_pelo(pg_temp.id('ubs'), 'pec'));
RESET ROLE;

SELECT pg_temp.ok((SELECT (j #>> '{}')::int = 1 FROM r) AND pg_temp.na_fila('idoso') = 'descartado',
  '3. com a RNDS pelo PEC, o RAC da UBS que estava na fila é descartado');
SELECT pg_temp.enfileirar('h40', 'consulta_no_dia');
SELECT pg_temp.ok(pg_temp.na_fila('h40', 'consulta_no_dia') = 'nada', '3. e o RAC novo da UBS não entra');
SELECT pg_temp.ok(pg_temp.na_fila('upa_pac') = 'pendente', '3. a UPA não muda');
SELECT pg_temp.ok((SELECT rac_aps_pelo = 'pec' FROM public.rnds_config_unidade WHERE unidade_id = pg_temp.id('ubs')), '3. a escolha fica gravada');

-- a escolha vale só para a UBS (o super admin passa pelo papel, não pelo tipo)
DO $$ BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('ges'), 'role', 'authenticated')::text, true);
  INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('ges'), pg_temp.id('upa'), 'gestor') ON CONFLICT DO NOTHING;
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ges');
DO $$ BEGIN
  PERFORM public.rnds_rac_aps_pelo(pg_temp.id('upa'), 'pec');
  RAISE EXCEPTION 'FALHOU: 4. na UPA — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'A escolha vale só para a UBS%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  4. a escolha vale só para a UBS';
END $$;
RESET ROLE;

ROLLBACK;
