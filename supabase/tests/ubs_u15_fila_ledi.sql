-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000022_ubs_u15_fila_ledi.sql (percurso da UBS,
-- U15, PR 2). Tudo em transação com ROLLBACK; o cenário é o mesmo do teste dos
-- indicadores da APS, criado aqui.
--
-- 1. o atendimento encerrado na UBS entra na fila como FAI, com o uuid da ficha
--    prefixado pelo CNES; a ficha vencida não entra; a conferência noturna pega
--    o que ficou fora;
-- 2. o procedimento da UBS entra como FP; cancelado antes do envio, é descartado;
-- 3. a carga retém sem IBGE e sem CNS ou CPF do paciente, e traz o resto;
-- 4. só o gestor da UBS configura (IBGE com 7 dígitos) e lê a fila.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000099a1'), ('ubs', '00000000-0000-4000-8000-0000000099a2'),
  ('cons', '00000000-0000-4000-8000-0000000099a3'),
  ('ges', '00000000-0000-4000-8000-0000000099b1'), ('med', '00000000-0000-4000-8000-0000000099b2'),
  ('enf', '00000000-0000-4000-8000-0000000099b3'), ('rec', '00000000-0000-4000-8000-0000000099b4'),
  ('idoso', '00000000-0000-4000-8000-0000000099c1'), ('m30', '00000000-0000-4000-8000-0000000099c2'),
  ('m55', '00000000-0000-4000-8000-0000000099c3'), ('h40', '00000000-0000-4000-8000-0000000099c4');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15b.local' FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 PR2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 PR2', 'ubs');
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

-- dados que o LEDI exige
UPDATE public.unidades SET cnes = '9912345' WHERE id = pg_temp.id('ubs');
UPDATE public.perfis SET cns = '700000000000005', cbo = '225125' WHERE id = pg_temp.id('med');
UPDATE public.perfis SET cns = '700000000000013', cbo = '223505' WHERE id = pg_temp.id('enf');
UPDATE public.pacientes SET cns = '898000000000002', cpf_justificativa = 8 WHERE id = pg_temp.id('idoso');  -- U15 (VC7): sem CPF, o motivo do LEDI
UPDATE public.pacientes SET cpf = '52998224725' WHERE id = pg_temp.id('h40');

CREATE FUNCTION pg_temp.ep(p text, p_tipo text DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.episodios WHERE paciente_id = pg_temp.id(p) AND (p_tipo IS NULL OR tipo_atendimento_aps = p_tipo) LIMIT 1 $$;
CREATE FUNCTION pg_temp.fila(p_tipo text, p_ref uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(status, ','), 'nada') FROM public.ledi_fila WHERE tipo = p_tipo AND referencia_id = p_ref $$;

-- 1. o idoso volta a ser encerrado (gatilho); a ficha da m55 venceu
UPDATE public.episodios SET etapa = 'atendimento', encerrado_em = NULL WHERE id = pg_temp.ep('idoso');
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now() - interval '10 days' WHERE id = pg_temp.ep('idoso');
UPDATE public.episodios SET desfecho = 'evasao', desfecho_em = now() - interval '3 days', desfecho_detalhes = '{"vencida": true}',
                            etapa = 'atendimento', encerrado_em = NULL
 WHERE id = pg_temp.ep('m55');
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now() - interval '3 days' WHERE id = pg_temp.ep('m55');
SELECT pg_temp.ok(pg_temp.fila('fai', pg_temp.ep('idoso')) = 'pendente'
                  AND (SELECT uuid_ficha LIKE '9912345-%' FROM public.ledi_fila WHERE referencia_id = pg_temp.ep('idoso')),
  '1. o atendimento encerrado na UBS entra na fila como FAI, com o uuid prefixado pelo CNES');
SELECT pg_temp.ok(pg_temp.fila('fai', pg_temp.ep('m55')) = 'nada', '1. a ficha que venceu não entra');
SELECT pg_temp.ok((SELECT (private.ledi_conferencia_noturna(((now() - interval '5 days') AT TIME ZONE 'America/Sao_Paulo')::date) ->> 'fai')::int >= 1)
                  AND pg_temp.fila('fai', pg_temp.ep('h40', 'consulta_no_dia')) = 'pendente',
  '1. a conferência noturna põe na fila o atendimento que ficou fora');
SELECT private.ledi_conferencia_noturna(((now() - interval '10 days') AT TIME ZONE 'America/Sao_Paulo')::date);
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.ledi_fila WHERE tipo = 'fai' AND referencia_id = pg_temp.ep('idoso')),
  '1. a conferência não repete a ficha que já está na fila');

-- 2. procedimento da UBS
INSERT INTO ids VALUES ('proc', '00000000-0000-4000-8000-0000000099e1');
INSERT INTO public.procedimentos_realizados (id, unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
                                             profissional_id, via, registrado_por)
VALUES (pg_temp.id('proc'), pg_temp.id('ubs'), pg_temp.id('h40'), pg_temp.ep('h40', 'consulta_no_dia'), '0214010015', 1, now(),
        pg_temp.id('enf'), 'quem_fez', pg_temp.id('enf'));
SELECT pg_temp.ok(pg_temp.fila('fp', pg_temp.id('proc')) = 'pendente', '2. o procedimento da UBS entra na fila como FP');

-- 3. carga
DO $$ BEGIN
  PERFORM private.ledi_carga_fai(pg_temp.ep('idoso'));
  RAISE EXCEPTION 'FALHOU: 3. sem IBGE — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'retido: unidade sem código IBGE%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  3. sem o IBGE do município a ficha fica retida';
END $$;

-- 4. configuração
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
DO $$ BEGIN
  PERFORM public.ledi_salvar_config(pg_temp.id('ubs'), '3550308', NULL, NULL);
  RAISE EXCEPTION 'FALHOU: 4. o enfermeiro configura — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  4. só o gestor configura o envio ao SISAB';
END $$;
SELECT pg_temp.como('ges');
DO $$ BEGIN
  PERFORM public.ledi_salvar_config(pg_temp.id('ubs'), '355', NULL, NULL);
  RAISE EXCEPTION 'FALHOU: 4. IBGE curto — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Código IBGE%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  4. o IBGE tem 7 dígitos';
END $$;
SELECT public.ledi_salvar_config(pg_temp.id('ubs'), '3550308', NULL, 'https://pec.exemplo.gov.br/');
INSERT INTO r SELECT to_jsonb(count(*)) FROM public.ledi_fila;
SELECT pg_temp.como('rec');
INSERT INTO r SELECT jsonb_build_object('rec', count(*)) FROM public.ledi_fila;
RESET ROLE;
SELECT pg_temp.ok((SELECT (j #>> '{}')::int >= 3 FROM r WHERE jsonb_typeof(j) = 'number')
                  AND (SELECT (j ->> 'rec')::int = 0 FROM r WHERE jsonb_typeof(j) = 'object'),
  '4. o gestor lê a fila; a recepção não');
SELECT pg_temp.ok((SELECT codigo_ibge = '3550308' AND pec_url = 'https://pec.exemplo.gov.br' AND NOT envio_ligado
                     FROM public.ledi_config_unidade WHERE unidade_id = pg_temp.id('ubs')),
  '4. a configuração fica gravada, com o envio desligado');

-- 3. carga com a configuração
SELECT pg_temp.ok((SELECT j @> '{"unidade": {"cnes": "9912345", "codigo_ibge": "3550308"}, "profissional": {"cns": "700000000000005", "cbo": "225125"},
                                  "cidadao": {"cns": "898000000000002", "justificativa_sem_cpf": 8}, "atendimento": {"tipo_atendimento": "consulta_programada"}}'
                     AND jsonb_array_length(j -> 'medicoes') >= 1
                     FROM (SELECT private.ledi_carga_fai(pg_temp.ep('idoso')) AS j) x),
  '3. a carga da FAI traz unidade, profissional, cidadão, atendimento e medições');
SELECT pg_temp.ok((SELECT j @> '{"profissional": {"cbo": "223505"}, "cidadao": {"cpf": "52998224725"}, "procedimento": {"codigo_sigtap": "0214010015"}}'
                     FROM (SELECT private.ledi_carga_fp(pg_temp.id('proc')) AS j) x),
  '3. a carga da FP traz o procedimento e quem fez');
DO $$ BEGIN
  PERFORM private.ledi_carga_fai(pg_temp.ep('m30'));
  RAISE EXCEPTION 'FALHOU: 3. paciente sem CPF e sem motivo — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'retido: paciente sem CPF e sem justificativa%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  3. paciente sem CPF e sem motivo fica retido (U15, VC7)';
END $$;

-- 2. cancelado antes do envio
UPDATE public.procedimentos_realizados SET cancelado_em = now(), cancelado_por = pg_temp.id('enf'), motivo_cancelamento = 'lançado por engano'
 WHERE id = pg_temp.id('proc');
SELECT pg_temp.ok(pg_temp.fila('fp', pg_temp.id('proc')) = 'descartado', '2. o procedimento cancelado antes do envio é descartado');

ROLLBACK;
