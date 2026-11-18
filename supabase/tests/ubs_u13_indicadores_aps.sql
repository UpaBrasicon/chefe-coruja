-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000019_ubs_u13_indicadores_aps.sql (percurso da
-- UBS, U13, PR 1). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. C1: atendimentos programados sobre o total, de médico e enfermeiro; ficha
--    vencida (sem profissional) não conta;
-- 2. C6: idoso com consulta e peso e altura no mesmo dia soma 50 (ACS e vacina
--    fora do app);
-- 3. C7: preventivo de 25 a 64 (as duas mulheres; uma fez), saúde sexual e reprodutiva de 14 a 69 e
--    mamografia de 50 a 69, cada um na sua faixa;
-- 4. a recepção não vê.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org', '00000000-0000-4000-8000-0000000096a1'), ('ubs', '00000000-0000-4000-8000-0000000096a2'),
  ('cons', '00000000-0000-4000-8000-0000000096a3'),
  ('ges', '00000000-0000-4000-8000-0000000096b1'), ('med', '00000000-0000-4000-8000-0000000096b2'),
  ('enf', '00000000-0000-4000-8000-0000000096b3'), ('rec', '00000000-0000-4000-8000-0000000096b4'),
  ('idoso', '00000000-0000-4000-8000-0000000096c1'), ('m30', '00000000-0000-4000-8000-0000000096c2'),
  ('m55', '00000000-0000-4000-8000-0000000096c3'), ('h40', '00000000-0000-4000-8000-0000000096c4');
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

INSERT INTO auth.users (id, email) SELECT id, nome || '@u13.local' FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U13');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U13', 'ubs');
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

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
DO $$ BEGIN
  PERFORM public.indicadores_aps(pg_temp.id('ubs'));
  RAISE EXCEPTION 'FALHOU: 4. a recepção não vê os indicadores — passou sem erro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  4. a recepção não vê os indicadores';
END $$;
SELECT pg_temp.como('ges');
INSERT INTO r SELECT public.indicadores_aps(pg_temp.id('ubs'));
RESET ROLE;

SELECT pg_temp.ok((SELECT (j -> 'c1' ->> 'programados')::int = 2 AND (j -> 'c1' ->> 'total')::int = 4 FROM r),
  '1. C1: 2 programados de 4 atendimentos de médico e enfermeiro (a ficha vencida não conta)');
SELECT pg_temp.ok((SELECT (j -> 'c6' ->> 'pessoas')::int = 1 AND (j -> 'c6' ->> 'media')::numeric = 50 FROM r),
  '2. C6: o idoso com consulta e peso e altura no mesmo dia soma 50');
SELECT pg_temp.ok((SELECT (j -> 'c7' -> 'colo' ->> 'faixa')::int = 2 AND (j -> 'c7' -> 'colo' ->> 'feito')::int = 1
                      AND (j -> 'c7' -> 'ssr' ->> 'faixa')::int = 2 AND (j -> 'c7' -> 'ssr' ->> 'feito')::int = 1
                      AND (j -> 'c7' -> 'mama' ->> 'faixa')::int = 1 AND (j -> 'c7' -> 'mama' ->> 'feito')::int = 1 FROM r),
  '3. C7: preventivo, saúde sexual e reprodutiva e mamografia, cada um na sua faixa');
SELECT pg_temp.ok(private.aps_ssr('{}', '{Z30.1}', '{}') AND private.aps_ssr('{}', '{}', '{W12}') AND NOT private.aps_ssr('{}', '{J06}', '{}'),
  '3. a lista de saúde sexual e reprodutiva da nota C7');

ROLLBACK;
