-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000023_ubs_u15_envio_pec.sql (percurso da UBS,
-- U15, PR 4). Tudo em transação com ROLLBACK; o cenário é o mesmo do teste dos
-- indicadores da APS, criado aqui.
--
-- 1. com o envio desligado, o serviço não pega nada; ligar exige IBGE e PEC;
--    só o gestor liga;
-- 2. ligado, o serviço pega a ficha e a trava; a carga traz o endereço do PEC;
-- 3. o resultado: reenviar volta à fila mais tarde; enviado fecha a ficha;
--    erro não volta;
-- 4. o usuário logado não chama as funções do serviço.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000094a1'), ('ubs', '00000000-0000-4000-8000-0000000094a2'),
  ('cons', '00000000-0000-4000-8000-0000000094a3'),
  ('ges', '00000000-0000-4000-8000-0000000094b1'), ('med', '00000000-0000-4000-8000-0000000094b2'),
  ('enf', '00000000-0000-4000-8000-0000000094b3'), ('rec', '00000000-0000-4000-8000-0000000094b4'),
  ('idoso', '00000000-0000-4000-8000-0000000094c1'), ('m30', '00000000-0000-4000-8000-0000000094c2'),
  ('m55', '00000000-0000-4000-8000-0000000094c3'), ('h40', '00000000-0000-4000-8000-0000000094c4');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15d.local' FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 PR4');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 PR4', 'ubs');
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

GRANT ALL ON r, ids TO service_role;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO service_role;
UPDATE public.unidades SET cnes = '9912345' WHERE id = pg_temp.id('ubs');
UPDATE public.perfis SET cns = '700000000000005', cbo = '225125' WHERE id = pg_temp.id('med');
UPDATE public.pacientes SET cns = '898000000000002', cpf_justificativa = 8 WHERE id = pg_temp.id('idoso');  -- U15 (VC7): sem CPF, o motivo do LEDI
CREATE FUNCTION pg_temp.ep(p text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.episodios WHERE paciente_id = pg_temp.id(p) LIMIT 1 $$;
UPDATE public.episodios SET etapa = 'atendimento', encerrado_em = NULL WHERE id = pg_temp.ep('idoso');
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now() - interval '10 days' WHERE id = pg_temp.ep('idoso');
INSERT INTO ids SELECT 'item', id FROM public.ledi_fila WHERE referencia_id = pg_temp.ep('idoso');
SELECT pg_temp.ok(pg_temp.id('item') IS NOT NULL, '0. a consulta do idoso está na fila');

-- 1. envio desligado
SET LOCAL ROLE service_role;
SELECT pg_temp.ok((SELECT count(*) = 0 FROM public.ledi_pegar_lote(10) x WHERE x.unidade_id = pg_temp.id('ubs')),
  '1. com o envio desligado, o serviço não pega a ficha');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('ges');
DO $$ BEGIN
  PERFORM public.ledi_ligar_envio(pg_temp.id('ubs'), true);
  RAISE EXCEPTION 'FALHOU: 1. ligou sem IBGE e PEC — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Para ligar o envio%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  1. ligar exige o IBGE e o endereço do PEC';
END $$;
SELECT public.ledi_salvar_config(pg_temp.id('ubs'), '3550308', NULL, 'https://pec.exemplo.gov.br');
SELECT pg_temp.como('enf');
DO $$ BEGIN
  PERFORM public.ledi_ligar_envio(pg_temp.id('ubs'), true);
  RAISE EXCEPTION 'FALHOU: 1. o enfermeiro liga — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  1. só o gestor liga o envio';
END $$;
DO $$ BEGIN
  PERFORM public.ledi_pegar_lote(10);
  RAISE EXCEPTION 'FALHOU: 4. o usuário logado pega o lote — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  4. o usuário logado não chama as funções do serviço';
END $$;
SELECT pg_temp.como('ges');
SELECT public.ledi_ligar_envio(pg_temp.id('ubs'), true);
RESET ROLE;

-- 2. ligado
SET LOCAL ROLE service_role;
INSERT INTO r SELECT to_jsonb(x) FROM public.ledi_pegar_lote(10) x WHERE x.unidade_id = pg_temp.id('ubs');
INSERT INTO r SELECT jsonb_build_object('segunda', count(*)) FROM public.ledi_pegar_lote(10) x WHERE x.unidade_id = pg_temp.id('ubs');
INSERT INTO r SELECT jsonb_build_object('dados', public.ledi_dados_ficha(pg_temp.id('item')));
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 1 FROM r WHERE j ->> 'id' = pg_temp.id('item')::text AND j ->> 'tipo' = 'fai' AND j ->> 'uuid_ficha' LIKE '9912345-%'),
  '2. ligado, o serviço pega a ficha com o uuid');
SELECT pg_temp.ok((SELECT (j ->> 'segunda')::int = 0 FROM r WHERE j ? 'segunda'), '2. a ficha pega fica travada');
SELECT pg_temp.ok((SELECT j -> 'dados' @> '{"tipo": "fai", "envio": {"pec_url": "https://pec.exemplo.gov.br"}, "carga": {"unidade": {"cnes": "9912345"}}}' FROM r WHERE j ? 'dados'),
  '2. a carga traz o endereço do PEC e a ficha');

-- 3. resultados
SET LOCAL ROLE service_role;
SELECT public.ledi_registrar_resultado(pg_temp.id('item'), 'reenviar', NULL, 'PEC fora do ar (503)');
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'pendente' AND tentativas = 1 AND proxima_tentativa_em > now() AND travado_ate IS NULL
                     FROM public.ledi_fila WHERE id = pg_temp.id('item')),
  '3. reenviar volta à fila, mais tarde');
SET LOCAL ROLE service_role;
SELECT public.ledi_registrar_resultado(pg_temp.id('item'), 'enviado', '{"status": 201}', NULL);
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'enviado' AND enviado_em IS NOT NULL AND tentativas = 2 FROM public.ledi_fila WHERE id = pg_temp.id('item')),
  '3. enviado fecha a ficha');
UPDATE public.ledi_fila SET status = 'pendente' WHERE id = pg_temp.id('item');
SET LOCAL ROLE service_role;
SELECT public.ledi_registrar_resultado(pg_temp.id('item'), 'erro', '{"status": 400}', 'Erro de validação');
RESET ROLE;
SELECT pg_temp.ok((SELECT status = 'erro' AND ultimo_erro = 'Erro de validação' FROM public.ledi_fila WHERE id = pg_temp.id('item')),
  '3. erro não volta à fila');

ROLLBACK;
