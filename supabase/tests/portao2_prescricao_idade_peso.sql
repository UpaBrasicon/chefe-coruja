-- Testes da migration 20261121000001_prescricao_idade_peso.sql (Portão 2,
-- tarefa 2: medicamento exige idade e peso, em qualquer idade). ROLLBACK no fim.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Dipirona', 'dipirona', 'comprimido 500 mg', 'teste-idade-peso'),
  ('Ceftriaxona', 'ceftriaxona', 'pó 1 g', 'teste-idade-peso');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento WHERE fonte = 'teste-idade-peso';
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
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
-- peso registrado pelo caminho da tela (fila de sinais vitais), com o método
CREATE FUNCTION pg_temp.pesar(p_pac uuid, p_kg numeric, p_metodo text, p_quando timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  SELECT private.inserir_observacao_sincronizada(gen_random_uuid(), '21000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000004', p_quando, false, NULL,
    jsonb_build_object('paciente_id', p_pac, 'conceito_id', (SELECT id FROM public.conceito WHERE nome = 'peso' AND unidade_id IS NULL),
                       'valor_num', p_kg, 'metodo', p_metodo)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.pesar(uuid, numeric, text, timestamptz) TO authenticated;

-- adulto com data de nascimento; e paciente sem data (trazido sem documento)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Adulto Sem Peso","data_nascimento":"1966-06-06"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'ep2', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Desconhecido Sem Idade"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'ep3', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Rascunho Sem Peso","data_nascimento":"1990-01-01"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac3', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep3');
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'pac2', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep2');
-- a chegada foi há 3 horas: peso de antes disso não vale
UPDATE public.episodios SET chegada_em = now() - interval '3 hours' WHERE id IN (pg_temp.u('ep'), pg_temp.u('ep2'));
SELECT pg_temp.pesar(pg_temp.u('pac'), 80, 'aferido', now() - interval '4 hours');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(e, 'verde',
  '{"frequencia-cardiaca":88,"frequencia-respiratoria":16,"temperatura":36.8,"saturacao-o2":98,"escala-dor":6,"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face', p_publico => 'adulto')
  FROM unnest(ARRAY[pg_temp.u('ep'), pg_temp.u('ep2')]) e;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
SELECT public.iniciar_atendimento(pg_temp.u('ep2'));

-- 6. a mensagem diz exatamente o que falta
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('dipirona'), 'dose', '1 comprimido', 'via', 'VO', 'posologia', 'agora')),
  'Falta para prescrever: peso deste atendimento (aferido ou estimado).', 'adulto sem peso deste atendimento não recebe medicamento');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac2'),
  json_build_object('medicamento_id', pg_temp.u('dipirona'), 'dose', '1 comprimido', 'via', 'VO', 'posologia', 'agora')),
  'Falta para prescrever: data de nascimento ou idade estimada; peso deste atendimento (aferido ou estimado).',
  'sem idade e sem peso: a mensagem lista os dois');

-- 5. cuidado não exige
INSERT INTO t SELECT 'cuid', public.prescrever(pg_temp.u('pac2'), '{"tipo":"cuidado","descricao":"Cabeceira elevada 30°"}');
DO $$ BEGIN
  IF pg_temp.u('cuid') IS NULL THEN RAISE EXCEPTION 'FALHOU: cuidado sem peso'; END IF;
  RAISE NOTICE 'OK  item de cuidado não exige idade nem peso';
END $$;

-- 1a. peso estimado resolve; o item guarda o peso
SELECT pg_temp.pesar(pg_temp.u('pac'), 75, 'estimado', now() - interval '1 hour');
INSERT INTO t SELECT 'i1', public.prescrever(pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('dipirona'), 'dose', '1 comprimido', 'via', 'VO', 'posologia', 'agora')::jsonb);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT peso_kg FROM public.prescricao_itens WHERE id = pg_temp.u('i1')) <> 75 THEN
    RAISE EXCEPTION 'FALHOU: o item deveria guardar o peso estimado (75), não o de antes da chegada';
  END IF;
  IF (SELECT metodo FROM public.observacao WHERE paciente_id = pg_temp.u('pac') AND valor_num = 75) <> 'estimado' THEN
    RAISE EXCEPTION 'FALHOU: método do peso não gravado';
  END IF;
  RAISE NOTICE 'OK  peso estimado deste atendimento libera; peso de antes da chegada não vale';
END $$;

-- 2a. idade estimada
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_idade_estimada(%L, 40)', pg_temp.u('pac')),
  'O paciente já tem data de nascimento no cadastro', 'idade estimada não apaga data de nascimento real');
SELECT pg_temp.falha(format('SELECT public.registrar_idade_estimada(%L, 200)', pg_temp.u('pac2')),
  'Informe a idade estimada em anos', 'idade estimada fora de 0 a 130 é recusada');
SELECT public.registrar_idade_estimada(pg_temp.u('pac2'), 40);
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac2'),
  json_build_object('medicamento_id', pg_temp.u('dipirona'), 'dose', '1 comprimido', 'via', 'VO', 'posologia', 'agora')),
  'Falta para prescrever: peso deste atendimento (aferido ou estimado).', 'com idade estimada, ainda falta o peso');
SELECT pg_temp.pesar(pg_temp.u('pac2'), 70, 'referido', now());
INSERT INTO t SELECT 'i2', public.prescrever(pg_temp.u('pac2'),
  json_build_object('medicamento_id', pg_temp.u('dipirona'), 'dose', '1 comprimido', 'via', 'VO', 'posologia', 'agora')::jsonb);
SELECT public.registrar_idade_estimada(pg_temp.u('pac2'), 45);
RESET ROLE;
DO $$
DECLARE p record;
BEGIN
  SELECT data_nascimento, data_nascimento_estimada INTO p FROM public.pacientes WHERE id = pg_temp.u('pac2');
  IF NOT p.data_nascimento_estimada THEN RAISE EXCEPTION 'FALHOU: idade estimada sem a marca'; END IF;
  IF p.data_nascimento <> ((now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '45 years')::date THEN
    RAISE EXCEPTION 'FALHOU: data estimada errada (%)', p.data_nascimento;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'registrar_idade_estimada' AND entidade_id = pg_temp.u('pac2')) THEN
    RAISE EXCEPTION 'FALHOU: idade estimada sem auditoria';
  END IF;
  -- marca não se liga por fora; data real tira a marca
  UPDATE public.pacientes SET data_nascimento_estimada = false WHERE id = pg_temp.u('pac2');
  IF NOT (SELECT data_nascimento_estimada FROM public.pacientes WHERE id = pg_temp.u('pac2')) THEN
    RAISE EXCEPTION 'FALHOU: a marca saiu sem a data real';
  END IF;
  UPDATE public.pacientes SET data_nascimento_estimada = true WHERE id = pg_temp.u('pac');
  IF (SELECT data_nascimento_estimada FROM public.pacientes WHERE id = pg_temp.u('pac')) THEN
    RAISE EXCEPTION 'FALHOU: a marca se ligou por fora';
  END IF;
  UPDATE public.pacientes SET data_nascimento = '1981-02-03' WHERE id = pg_temp.u('pac2');
  IF (SELECT data_nascimento_estimada FROM public.pacientes WHERE id = pg_temp.u('pac2')) THEN
    RAISE EXCEPTION 'FALHOU: data real gravada e a marca ficou';
  END IF;
  RAISE NOTICE 'OK  idade estimada grava a data com a marca e auditoria; a data real tira a marca';
END $$;

-- 5. inserção direta (caminho antigo, tela de teste) também trava
WITH x AS (
  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status)
  VALUES ('21000000-0000-4000-8000-000000000001', pg_temp.u('pac3'), '10000000-0000-4000-8000-000000000002', 'rascunho')
  RETURNING id)
INSERT INTO t SELECT 'rasc', id::text FROM x;
SELECT pg_temp.falha(format('INSERT INTO public.prescricao_itens (prescricao_id, descricao) VALUES (%L, %L)', pg_temp.u('rasc'), 'dipirona'),
  'Falta para prescrever: peso deste atendimento', 'inserção direta de medicamento sem peso também trava');
INSERT INTO public.prescricao_itens (prescricao_id, descricao, tipo) VALUES (pg_temp.u('rasc'), 'Repouso', 'cuidado');
DO $$ BEGIN RAISE NOTICE 'OK  inserção direta de cuidado passa'; END $$;

-- 3a. na internação o peso vale desde a chegada à porta
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.registrar_soap(pg_temp.u('ep'), 'dor', 'exame', 'avaliação', 'observar', 'R52');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'observacao');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.internacoes WHERE episodio_id = pg_temp.u('ep')) THEN
    RAISE EXCEPTION 'FALHOU: internação de observação não aberta';
  END IF;
  IF private.inicio_do_atendimento(pg_temp.u('pac')) <> now() - interval '3 hours' THEN
    RAISE EXCEPTION 'FALHOU: a internação deveria contar desde a chegada (%)', private.inicio_do_atendimento(pg_temp.u('pac'));
  END IF;
  IF private.peso_do_atendimento(pg_temp.u('pac')) <> 75 THEN
    RAISE EXCEPTION 'FALHOU: peso da porta deveria valer na internação';
  END IF;
  RAISE NOTICE 'OK  peso da porta vale a internação inteira';
END $$;

ROLLBACK;
