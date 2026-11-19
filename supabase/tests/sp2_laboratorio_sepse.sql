-- Testes da migration 20270418000096 (SP2: laboratório do parceiro para a sepse). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok, false) THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;

-- L2: a referência bate com as tabelas oficiais quando carregadas inteiras (homologação e produção; o CI tem só uma parte)
SELECT pg_temp.confere((SELECT count(*) = 7 FROM public.exames_referencia_sepse), '7 exames da sepse na referência');
SELECT pg_temp.confere(
  (SELECT count(*) FROM terminologia.sigtap_procedimento) < 1000
  OR NOT EXISTS (SELECT 1 FROM public.exames_referencia_sepse r
                  WHERE NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento s WHERE s.codigo = r.procedimento)),
  'todo procedimento da referência existe no SIGTAP carregado');
SELECT pg_temp.confere(
  (SELECT count(*) FROM terminologia.loinc) < 50000
  OR NOT EXISTS (SELECT 1 FROM public.exames_referencia_sepse r
                  CROSS JOIN LATERAL (SELECT r.loinc_pedido AS c UNION ALL SELECT a ->> 'loinc' FROM jsonb_array_elements(r.analitos) a) x
                  WHERE NOT EXISTS (SELECT 1 FROM terminologia.loinc l WHERE l.codigo = x.c)),
  'todo LOINC da referência (pedido e analitos) existe no LOINC carregado');

-- L3: número do laudo
SELECT pg_temp.confere((SELECT numero = 150000 AND comparador IS NULL FROM private.valor_do_laudo('150.000')), '"150.000" é milhar');
SELECT pg_temp.confere((SELECT numero = 1234.5 FROM private.valor_do_laudo('1.234,5')), '"1.234,5" = 1234,5');
SELECT pg_temp.confere((SELECT numero = 1.2 FROM private.valor_do_laudo('1,2')), '"1,2" = 1,2');
SELECT pg_temp.confere((SELECT numero = 1.2 FROM private.valor_do_laudo('1.2')), '"1.2" = 1,2');
SELECT pg_temp.confere((SELECT numero = 0.5 AND comparador = '<' FROM private.valor_do_laudo('<0,5')), '"<0,5" = 0,5 com <');
SELECT pg_temp.confere((SELECT numero = 90 AND comparador = '>=' FROM private.valor_do_laudo('≥ 90')), '"≥ 90" = 90 com >=');
SELECT pg_temp.confere((SELECT numero IS NULL AND comparador IS NULL FROM private.valor_do_laudo('Negativo')), 'texto não vira número');

-- preparo: unidade, gestora, paciente, atendimento e um pedido coletado
CREATE TEMP TABLE k (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON k TO authenticated;
CREATE FUNCTION pg_temp.k(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM k WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.k(text) TO authenticated;
INSERT INTO k SELECT 'unidade', s.unidade_id FROM public.setores s ORDER BY s.unidade_id, s.id LIMIT 1;
INSERT INTO k SELECT 'setor', s.id FROM public.setores s WHERE s.unidade_id = pg_temp.k('unidade') ORDER BY s.id LIMIT 1;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
VALUES ('10000000-0000-4000-8000-000000000001', pg_temp.k('unidade'), 'gestor', '10000000-0000-4000-8000-000000000001')
ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true;
-- o SIGTAP dos 7 exames (o CI pode não ter a tabela carregada)
INSERT INTO terminologia.sigtap_procedimento (codigo, nome)
SELECT procedimento, upper(nome_curto) FROM public.exames_referencia_sepse ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (unidade_id, nome, data_nascimento) VALUES (pg_temp.k('unidade'), 'SP2 Paciente', '1960-01-01');
INSERT INTO k SELECT 'paciente', id FROM public.pacientes WHERE nome = 'SP2 Paciente' AND unidade_id = pg_temp.k('unidade');
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, chegada_em)
VALUES (pg_temp.k('unidade'), pg_temp.k('paciente'), pg_temp.k('setor'), 'Febre', '10000000-0000-4000-8000-000000000002', now() - interval '3 days');
-- pedido coletado há 3 dias, laudo liberado só agora: a creatinina 2,5 vale na hora da coleta
INSERT INTO public.exames_pedidos (unidade_id, paciente_id, exame, pedido_por, pedido_em, coletado_em)
VALUES (pg_temp.k('unidade'), pg_temp.k('paciente'), 'Creatinina', '10000000-0000-4000-8000-000000000002', now() - interval '3 days', now() - interval '3 days');
INSERT INTO k SELECT 'pedido', id FROM public.exames_pedidos WHERE paciente_id = pg_temp.k('paciente');
INSERT INTO public.exame_resultados (exame_id, versao, origem, texto, liberado_em)
VALUES (pg_temp.k('pedido'), 1, 'laboratorio', 'Creatinina 2,5', now());
INSERT INTO k SELECT 'resultado', id FROM public.exame_resultados WHERE exame_id = pg_temp.k('pedido');
INSERT INTO public.exame_resultado_itens (resultado_id, analito, loinc, valor_texto, valor_num, unidade)
VALUES (pg_temp.k('resultado'), 'Creatinina', '2160-0', '2,5', 2.5, 'mg/dL'),
       (pg_temp.k('resultado'), 'Leucócitos', '6690-2', '12.500', 12.5, '/mm³'),
       (pg_temp.k('resultado'), 'PCR', '1988-5', '<0,5', NULL, 'mg/dL');
SELECT pg_temp.confere((SELECT valor_num = 12500 FROM public.exame_resultado_itens WHERE resultado_id = pg_temp.k('resultado') AND analito = 'Leucócitos'),
  'gatilho corrige "12.500" para 12500 mesmo se veio 12,5');
SELECT pg_temp.confere((SELECT valor_num = 0.5 AND comparador = '<' FROM public.exame_resultado_itens WHERE resultado_id = pg_temp.k('resultado') AND analito = 'PCR'),
  'gatilho grava "<0,5" como 0,5 com <');
SELECT pg_temp.confere((private.sofa_janela(pg_temp.k('paciente'), now() - interval '3 days' - interval '1 hour', now() - interval '2 days') ->> 'renal')::int = 2,
  'SOFA usa a hora da coleta (há 3 dias), não a da liberação (agora)');
SELECT pg_temp.confere((private.sofa_janela(pg_temp.k('paciente'), now() - interval '1 hour', now() + interval '1 hour') ->> 'tem_creatinina')::boolean IS FALSE,
  'fora da janela da coleta, a creatinina não conta');

-- L2: a gestora aplica os exames da sepse
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE a ON COMMIT DROP AS SELECT public.aplicar_exames_sepse(pg_temp.k('unidade')) AS j;
SELECT pg_temp.confere((SELECT jsonb_array_length(j -> 'incluidos') + jsonb_array_length(j -> 'loinc_preenchido') + jsonb_array_length(j -> 'mantidos') >= 1 FROM a),
  'aplicar devolve o que fez');
SELECT pg_temp.confere(jsonb_array_length((public.aplicar_exames_sepse(pg_temp.k('unidade'))) -> 'incluidos') = 0, 'aplicar de novo não inclui nada');
SELECT pg_temp.confere(jsonb_typeof(public.recusas_laboratorio_sem_pedido(pg_temp.k('unidade'), 8)) = 'array', 'gestora vê as recusas da semana');
SELECT set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000005', 'role', 'authenticated')::text, true);
SELECT pg_temp.falha($$SELECT public.aplicar_exames_sepse(pg_temp.k('unidade'))$$, 'Acesso negado', 'quem não é gestor não aplica');
SELECT pg_temp.falha($$SELECT public.recusas_laboratorio_sem_pedido(pg_temp.k('unidade'), 8)$$, 'Acesso negado', 'quem não é gestor não vê as recusas');
RESET ROLE;
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.exames_unidade WHERE unidade_id = pg_temp.k('unidade') AND procedimento = '0202080153'
  AND loinc = '600-7' AND vigente_ate IS NULL), 'hemocultura no catálogo com LOINC 600-7');
SELECT pg_temp.confere(NOT has_function_privilege('anon', 'public.aplicar_exames_sepse(uuid)', 'EXECUTE'), 'anônimo não aplica');

ROLLBACK;
