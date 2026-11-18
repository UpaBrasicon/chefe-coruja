-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000020_ubs_u13_gestao_ambulatorial.sql (percurso
-- da UBS, U13, PR 2). Tudo em transação com ROLLBACK; o cenário é o mesmo do
-- teste dos indicadores da APS, criado aqui.
--
-- 1. produção: atendimentos de médico e enfermeiro por tipo, faixa e
--    profissional; a ficha vencida fica fora e conta em "fichas vencidas";
-- 2. agenda: consultas por situação e comparecimento;
-- 3. só o gestor vê; período de até um ano.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000097a1'), ('ubs', '00000000-0000-4000-8000-0000000097a2'),
  ('cons', '00000000-0000-4000-8000-0000000097a3'),
  ('ges', '00000000-0000-4000-8000-0000000097b1'), ('med', '00000000-0000-4000-8000-0000000097b2'),
  ('enf', '00000000-0000-4000-8000-0000000097b3'), ('rec', '00000000-0000-4000-8000-0000000097b4'),
  ('idoso', '00000000-0000-4000-8000-0000000097c1'), ('m30', '00000000-0000-4000-8000-0000000097c2'),
  ('m55', '00000000-0000-4000-8000-0000000097c3'), ('h40', '00000000-0000-4000-8000-0000000097c4');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u13b.local' FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U13 PR2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U13 PR2', 'ubs');
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

-- agenda: uma consulta realizada e uma falta no período
INSERT INTO public.agendamentos (unidade_id, perfil_id, paciente_id, tipo, inicio, fim, situacao, tipo_atendimento_aps, marcado_por, episodio_id)
VALUES
  (pg_temp.id('ubs'), pg_temp.id('med'), pg_temp.id('idoso'), 'consulta', now() - interval '10 days', now() - interval '10 days' + interval '20 minutes', 'realizado', 'consulta_programada', pg_temp.id('rec'),
   (SELECT id FROM public.episodios WHERE paciente_id = pg_temp.id('idoso'))),
  (pg_temp.id('ubs'), pg_temp.id('enf'), pg_temp.id('m30'), 'consulta', now() - interval '6 days', now() - interval '6 days' + interval '20 minutes', 'nao_compareceu', 'consulta_agendada', pg_temp.id('rec'), NULL);
UPDATE public.episodios SET desfecho = 'evasao', desfecho_em = now() - interval '3 days', desfecho_detalhes = '{"vencida": true}' WHERE paciente_id = pg_temp.id('m55');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
DO $$ BEGIN
  PERFORM public.gestao_ubs(pg_temp.id('ubs'));
  RAISE EXCEPTION 'FALHOU: 3. o enfermeiro não vê a gestão — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  3. só o gestor vê a gestão';
END $$;
SELECT pg_temp.como('ges');
DO $$ BEGIN
  PERFORM public.gestao_ubs(pg_temp.id('ubs'), private.data_atual() - 400, private.data_atual());
  RAISE EXCEPTION 'FALHOU: 3. período de mais de um ano — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Período:%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  3. período de mais de um ano é recusado';
END $$;
INSERT INTO r SELECT public.gestao_ubs(pg_temp.id('ubs'));
RESET ROLE;

SELECT pg_temp.ok((SELECT (j -> 'producao' ->> 'total')::int = 4
                      AND (j -> 'producao' -> 'por_tipo' ->> 'consulta_programada')::int = 1
                      AND (j -> 'producao' -> 'por_faixa' ->> 'de_60_mais')::int = 1
                      AND jsonb_array_length(j -> 'producao' -> 'por_profissional') = 2
                      AND (j -> 'producao' ->> 'hipertensos')::int = 1 FROM r),
  '1. produção: 4 atendimentos de médico e enfermeiro, por tipo, faixa e profissional');
SELECT pg_temp.ok((SELECT (j -> 'espera' ->> 'fichas_vencidas')::int = 1 FROM r), '1. a ficha vencida conta em fichas vencidas');
SELECT pg_temp.ok((SELECT (j -> 'agenda' -> 'por_situacao' ->> 'realizado')::int = 1
                      AND (j -> 'agenda' -> 'por_situacao' ->> 'nao_compareceu')::int = 1
                      AND (j -> 'agenda' ->> 'comparecimento')::numeric = 50 FROM r),
  '2. agenda: uma realizada, uma falta, 50% de comparecimento');

ROLLBACK;
