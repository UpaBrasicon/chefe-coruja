-- Testes da migration 20261130000001_dispensacao_farmacia.sql (Fase 5B, etapa
-- 3.2): sugestão de quantidade, dispensação pelo farmacêutico (valida o item),
-- retirada sem farmacêutico pela enfermagem com justificativa e conferência,
-- avulsa, devolução e estoque negativo com aviso. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico') ON CONFLICT DO NOTHING;
-- enfermeira de plantão no PS agora
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id = '10000000-0000-4000-8000-000000000004' AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('00000000-0000-4000-8000-0000000d3201', 'Ceftriaxona D', 'ceftriaxona d', 'Frasco 1 g po', 'teste-disp'),
  ('00000000-0000-4000-8000-0000000d3202', 'Dipirona D', 'dipirona d', 'Ampola 2 mL', 'teste-disp'),
  ('00000000-0000-4000-8000-0000000d3203', 'Ondansetrona D', 'ondansetrona d', 'Ampola 4 mL', 'teste-disp'),
  ('00000000-0000-4000-8000-0000000d3204', 'Insulina D', 'insulina d', 'Frasco 10 mL', 'teste-disp');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', 'Paciente Dispensa', '1970-01-01', 'D-1',
   '22000000-0000-4000-8000-000000000003', 'F');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_medico_id, atendimento_iniciado_em)
VALUES ('25000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d3201',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'Febre', '10000000-0000-4000-8000-000000000004', now() - interval '2 hours',
        '10000000-0000-4000-8000-000000000002', now() - interval '1 hour');
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d3201', id, now() - interval '90 minutes', 70, 'manual'
  FROM public.conceito WHERE nome = 'peso' AND unidade_id IS NULL;
INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, episodio_id, criada_por)
VALUES ('2a000000-0000-4000-8000-0000000d3201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d3201',
        '10000000-0000-4000-8000-000000000002', 'ativa', '25000000-0000-4000-8000-0000000d3201', '10000000-0000-4000-8000-000000000002');
INSERT INTO public.prescricao_itens (id, prescricao_id, medicamento_id, descricao, dose, via, posologia, se_necessario, tipo, ordem, autor_id) VALUES
  ('2b000000-0000-4000-8000-0000000d3201', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3201', 'Ceftriaxona', '2 g', 'EV', '24/24h', false, 'medicamento', 1, '10000000-0000-4000-8000-000000000002'),
  ('2b000000-0000-4000-8000-0000000d3202', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3202', 'Dipirona', '1 g', 'EV', '6/6h se dor', false, 'medicamento', 2, '10000000-0000-4000-8000-000000000002'),
  ('2b000000-0000-4000-8000-0000000d3203', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3203', 'Ondansetrona', '2 ampolas', 'EV', '8/8h', false, 'medicamento', 3, '10000000-0000-4000-8000-000000000002'),
  ('2b000000-0000-4000-8000-0000000d3204', '2a000000-0000-4000-8000-0000000d3201', '00000000-0000-4000-8000-0000000d3204', 'Insulina', '3 UI/h', 'EV', 'contínuo em bomba', false, 'medicamento', 4, '10000000-0000-4000-8000-000000000002');
INSERT INTO public.estoque_medicamento (unidade_id, medicamento_id, quantidade, atualizado_por) VALUES
  ('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d3201', 10, '10000000-0000-4000-8000-000000000006');

-- 3b. sugestão
DO $$
DECLARE a jsonb := private.sugestao_dispensacao('2b000000-0000-4000-8000-0000000d3201');
        b jsonb := private.sugestao_dispensacao('2b000000-0000-4000-8000-0000000d3202');
        c jsonb := private.sugestao_dispensacao('2b000000-0000-4000-8000-0000000d3203');
        d jsonb := private.sugestao_dispensacao('2b000000-0000-4000-8000-0000000d3204');
BEGIN
  IF (a ->> 'quantidade')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: ceftriaxona 2 g 24/24h com frasco de 1 g deveria sugerir 2: %', a; END IF;
  IF (b ->> 'quantidade')::int <> 1 OR jsonb_array_length(b -> 'notas') < 1 THEN RAISE EXCEPTION 'FALHOU: dipirona se dor (massa × volume): %', b; END IF;
  IF (c ->> 'quantidade')::int <> 6 THEN RAISE EXCEPTION 'FALHOU: ondansetrona 2 ampolas 8/8h deveria sugerir 6: %', c; END IF;
  IF d ->> 'quantidade' IS NOT NULL OR d -> 'notas' ->> 0 NOT LIKE 'Infusão contínua%' THEN RAISE EXCEPTION 'FALHOU: infusão contínua: %', d; END IF;
  RAISE NOTICE 'OK  3b: sugestão conta embalagens (2 frascos; 1 com aviso; 6 ampolas; infusão sem sugestão)';
END $$;

CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM t WHERE k = p $$;
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

SET LOCAL ROLE authenticated;
-- quem não pode
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.dispensar_item('2b000000-0000-4000-8000-0000000d3201', 2)$$, 'Acesso negado', 'médico não dispensa');
-- 2b. enfermagem: só com justificativa, marcada sem farmacêutico; estoque negativo (5a)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.dispensar_item('2b000000-0000-4000-8000-0000000d3203', 6)$$,
  'Retirada sem farmacêutico: escreva a justificativa', 'enfermagem só retira com justificativa');
INSERT INTO t SELECT 'enf', public.dispensar_item('2b000000-0000-4000-8000-0000000d3203', 6, 'farmácia fechada de madrugada') ->> 'id';
SELECT pg_temp.falha($$SELECT public.dispensar_avulso('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d3202', 5, 'carrinho do PS', 'reposição do carrinho de emergência')$$,
  'Acesso negado', 'avulsa é só do farmacêutico');
-- farmacêutico: dispensa e valida; avulsa; devolução; conferência
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'farm', public.dispensar_item('2b000000-0000-4000-8000-0000000d3201', 2) ->> 'id';
SELECT pg_temp.falha($$SELECT public.dispensar_avulso('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d3202', 5, 'x', 'reposição do carrinho de emergência')$$,
  'Informe o destino', 'avulsa pede destino');
SELECT public.dispensar_avulso('21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d3202', 5, 'Carrinho de emergência do PS', 'reposição após atendimento de PCR');
SELECT pg_temp.falha(format('SELECT public.devolver_dispensacao(%L, 3, %L)', pg_temp.u('farm'), 'sobrou da dose do dia'),
  'Quantidade a devolver entre 1 e 2', 'não devolve mais do que saiu');
SELECT public.devolver_dispensacao(pg_temp.u('farm'), 1, 'paciente teve alta antes da dose');
SELECT public.conferir_dispensacao(pg_temp.u('enf'));
SELECT pg_temp.falha(format('SELECT public.conferir_dispensacao(%L)', pg_temp.u('farm')), 'Esta dispensação foi feita pelo farmacêutico', 'só se confere a retirada sem farmacêutico');
DO $$
DECLARE l jsonb := public.dispensacoes_da_unidade('21000000-0000-4000-8000-000000000001');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'estoque_negativo') x WHERE x ->> 'medicamento' LIKE 'Ondansetrona D%' AND (x ->> 'saldo')::numeric = -6)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'estoque_negativo') x WHERE x ->> 'medicamento' LIKE 'Dipirona D%' AND (x ->> 'saldo')::numeric = -5) THEN
    RAISE EXCEPTION 'FALHOU: estoque negativo na lista: %', l -> 'estoque_negativo';
  END IF;
  IF jsonb_array_length(l -> 'dispensacoes') < 3 THEN RAISE EXCEPTION 'FALHOU: lista de dispensações'; END IF;
  RAISE NOTICE 'OK  5a: saldo negativo não bloqueia e aparece para a farmácia conferir';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT quantidade FROM public.estoque_medicamento WHERE medicamento_id = '00000000-0000-4000-8000-0000000d3201') <> 9 THEN
    RAISE EXCEPTION 'FALHOU: estoque da ceftriaxona deveria ser 10 - 2 + 1 = 9';
  END IF;
  IF (SELECT situacao FROM public.validacoes_prescricao WHERE item_id = '2b000000-0000-4000-8000-0000000d3201' ORDER BY em DESC LIMIT 1) <> 'confere' THEN
    RAISE EXCEPTION 'FALHOU: dispensar pelo farmacêutico deveria validar o item';
  END IF;
  IF EXISTS (SELECT 1 FROM public.validacoes_prescricao WHERE item_id = '2b000000-0000-4000-8000-0000000d3203') THEN
    RAISE EXCEPTION 'FALHOU: retirada da enfermagem não valida';
  END IF;
  IF (SELECT sem_farmaceutico AND conferida_em IS NOT NULL AND motivo = 'farmácia fechada de madrugada' FROM public.dispensacoes WHERE id = pg_temp.u('enf')) IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: retirada sem farmacêutico e conferência';
  END IF;
  IF has_table_privilege('authenticated', 'public.dispensacoes', 'INSERT') THEN RAISE EXCEPTION 'FALHOU: dispensação gravável por fora'; END IF;
  RAISE NOTICE 'OK  6a/4a/2b: farmacêutico valida ao dispensar; devolução volta ao estoque; retirada da enfermagem conferida depois';
END $$;
ROLLBACK;
