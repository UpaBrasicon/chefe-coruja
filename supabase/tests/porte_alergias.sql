-- Testes da migration 20261003000002 (alergia em três estados e evento
-- adverso). ROLLBACK no fim. Estilo de fase4_prescricao_diluicao.sql.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Ceftriaxona', 'ceftriaxona', 'pó 1 g', 'teste'),
  ('Dipirona', 'dipirona', 'solução 500 mg/mL 2 mL', 'teste');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'cef', id::text FROM public.medicamento WHERE principio_ativo_norm = 'ceftriaxona' AND fonte = 'teste';
INSERT INTO t SELECT 'dip', id::text FROM public.medicamento WHERE principio_ativo_norm = 'dipirona' AND fonte = 'teste';
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
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;

-- ── paciente na porta ───────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Alergia Adulto","data_nascimento":"1970-03-03"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'ep2', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL,
  '{"nome":"Alergia Outro","data_nascimento":"1980-04-04"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
INSERT INTO t SELECT 'pac2', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep2');

-- ── três estados: não registrada → nega → tem ───────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.confere(public.estado_alergia(pg_temp.u('pac')) = 'nao_registrada', 'sem nada registrado: "não registrada" (não é "nega")');
INSERT INTO t SELECT 'nega1', public.registrar_nega_alergia(pg_temp.u('pac'));
SELECT pg_temp.confere(public.estado_alergia(pg_temp.u('pac')) = 'nega', '"nega alergias" é um registro: estado "nega"');
SELECT pg_temp.confere((SELECT registrado_por FROM public.alergias_negacoes WHERE id = pg_temp.u('nega1')) = '10000000-0000-4000-8000-000000000004',
  '"nega" guarda o autor do login e a hora');
SELECT public.registrar_nega_alergia(pg_temp.u('pac'));
SELECT pg_temp.confere((SELECT count(*) FROM public.alergias_negacoes WHERE paciente_id = pg_temp.u('pac')) = 2
  AND (SELECT count(*) FROM public.alergias_negacoes WHERE paciente_id = pg_temp.u('pac') AND encerrada_em IS NULL) = 1,
  'reconfirmar "nega": nova linha, a anterior fica no histórico, só uma vigente');

SELECT pg_temp.falha(format('SELECT public.registrar_alergia(%L, %L, NULL, %L)', pg_temp.u('pac'), 'Dipirona', 'remedio'),
  'Tipo de alergia desconhecido', 'tipo fora da lista é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_alergia(%L, %L, NULL, %L, %L)', pg_temp.u('pac'), 'Dipirona', 'medicamento', 'fatal'),
  'Gravidade desconhecida', 'gravidade fora da lista é recusada');
SELECT pg_temp.falha(format('SELECT public.registrar_alergia(%L, %L, NULL, %L, %L, %L)', pg_temp.u('pac'), 'Amendoim', 'alimento', 'leve', pg_temp.u('dip')),
  'Só alergia a medicamento se liga ao cadastro', 'alimento não se liga ao cadastro de medicamentos');

INSERT INTO t SELECT 'a1', public.registrar_alergia(pg_temp.u('pac'), 'Dipirona', 'urticária e edema de lábios', 'medicamento', 'grave');
SELECT pg_temp.confere(public.estado_alergia(pg_temp.u('pac')) = 'tem', 'registrar alergia: estado "tem"');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.alergias_negacoes WHERE paciente_id = pg_temp.u('pac')
    AND encerrada_em IS NOT NULL AND encerrada_por = '10000000-0000-4000-8000-000000000004' AND motivo_encerramento = 'Alergia registrada: Dipirona'),
  'registrar alergia encerra o "nega" vigente, com quem e o motivo');
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM public.alergias_negacoes WHERE paciente_id = pg_temp.u('pac') AND encerrada_em IS NULL),
  'nenhum "nega" vigente ao lado de alergia ativa');
SELECT pg_temp.confere((SELECT medicamento_id = pg_temp.u('dip') AND tipo = 'medicamento' AND gravidade = 'grave'
    FROM public.alergias_paciente WHERE id = pg_temp.u('a1')),
  'medicamento com o nome do cadastro fica ligado a ele, com tipo e gravidade');
SELECT pg_temp.confere(public.registrar_alergia(pg_temp.u('pac'), ' dipirona ', NULL, 'medicamento', 'leve') = pg_temp.u('a1'),
  'a mesma substância ativa não se duplica');
SELECT pg_temp.falha(format('SELECT public.registrar_nega_alergia(%L)', pg_temp.u('pac')),
  'O paciente tem alergia ativa registrada (Dipirona)', '"nega" só é aceito sem alergia ativa');
INSERT INTO t SELECT 'a2', public.registrar_alergia(pg_temp.u('pac'), 'Amendoim', 'prurido', 'alimento', 'leve');
SELECT pg_temp.confere((SELECT medicamento_id IS NULL FROM public.alergias_paciente WHERE id = pg_temp.u('a2')), 'alimento sem ligação ao cadastro');
-- compatibilidade: a chamada curta da fase 4 continua valendo
INSERT INTO t SELECT 'a3', public.registrar_alergia(pg_temp.u('pac2'), 'Látex', 'urticária');
SELECT pg_temp.confere((SELECT tipo = 'medicamento' AND gravidade = 'desconhecida' FROM public.alergias_paciente WHERE id = pg_temp.u('a3')),
  'chamada curta (paciente, substância, reação) continua aceita, com gravidade "desconhecida"');

-- ── a trava da prescrição não mudou ─────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.prescrever(%L, %L)', pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('dip'), 'dose', '1 g', 'via', 'EV', 'posologia', '6/6h')),
  'ALERGIA', 'alergia registrada continua travando o item da prescrição');
INSERT INTO t SELECT 'i1', public.prescrever(pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '1 g', 'via', 'EV', 'posologia', '24/24h')::jsonb);
INSERT INTO t SELECT 'i2', public.prescrever(pg_temp.u('pac2'),
  json_build_object('medicamento_id', pg_temp.u('cef'), 'dose', '2 g', 'via', 'EV', 'posologia', '24/24h')::jsonb);

-- ── evento adverso: grau 1–6, evoluir com histórico ─────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_evento_adverso(%L, %L, 7, %L)', pg_temp.u('pac'), 'Exantema', pg_temp.u('i1')),
  'Grau do evento', 'grau fora de 1–6 é recusado');
SELECT pg_temp.falha(format('SELECT public.registrar_evento_adverso(%L, %L, 2, %L)', pg_temp.u('pac'), 'Exantema', pg_temp.u('i2')),
  'O item de prescrição não é deste paciente', 'item de prescrição de outro paciente é recusado');
INSERT INTO t SELECT 'e1', public.registrar_evento_adverso(pg_temp.u('pac'), 'Exantema', 2, pg_temp.u('i1'), 'tronco e membros');
SELECT pg_temp.confere((SELECT prescricao_item_id = pg_temp.u('i1') AND item_descricao LIKE 'Ceftriaxona%1 g%EV' AND grau = 2
    FROM public.eventos_adversos WHERE id = pg_temp.u('e1')),
  'evento ligado ao item da prescrição, com o retrato do item');
SELECT public.evoluir_grau_evento(pg_temp.u('e1'), 4);
SELECT pg_temp.falha(format('SELECT public.evoluir_grau_evento(%L, 4)', pg_temp.u('e1')), 'O evento já está nesse grau', 'evoluir para o mesmo grau é recusado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.evoluir_grau_evento(pg_temp.u('e1'), 3);
SELECT pg_temp.confere(
  -- (na transação do teste a hora é a mesma: confere o conjunto, não a ordem)
  (SELECT array_agg(grau ORDER BY grau) FROM public.eventos_adversos_graus WHERE evento_id = pg_temp.u('e1')) = ARRAY[2, 3, 4]::smallint[]
  AND (SELECT count(DISTINCT registrado_por) FROM public.eventos_adversos_graus WHERE evento_id = pg_temp.u('e1')) = 2
  AND (SELECT grau FROM public.eventos_adversos WHERE id = pg_temp.u('e1')) = 3
  AND public.rotulo_grau_evento(3) = 'Moderado' AND public.rotulo_grau_evento(6) = 'Morte',
  'evoluir o grau: histórico 2 → 4 → 3 com autor, grau atual 3 (Moderado)');
INSERT INTO t SELECT 'e2', public.registrar_evento_adverso(pg_temp.u('pac'), 'Cefaleia', 1);
SELECT pg_temp.confere((SELECT prescricao_item_id IS NULL FROM public.eventos_adversos WHERE id = pg_temp.u('e2')), 'evento sem item de prescrição também vale');

-- ── fora do plantão: não lê nem escreve ─────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.registrar_nega_alergia(%L)', pg_temp.u('pac2')), 'Acesso negado', 'fora do plantão não registra "nega"');
SELECT pg_temp.falha(format('SELECT public.registrar_evento_adverso(%L, %L, 1)', pg_temp.u('pac'), 'Náusea'), 'Acesso negado', 'fora do plantão não registra evento');
SELECT pg_temp.confere((SELECT count(*) FROM public.eventos_adversos) = 0 AND (SELECT count(*) FROM public.alergias_negacoes) = 0
  AND (SELECT count(*) FROM public.eventos_adversos_graus) = 0, 'fora do plantão não lê eventos nem "nega" (RLS)');
SELECT pg_temp.falha(format('INSERT INTO public.eventos_adversos (unidade_id, paciente_id, evento, grau, registrado_por) VALUES (%L, %L, %L, 1, %L)',
  '21000000-0000-4000-8000-000000000001', pg_temp.u('pac'), 'Direto', '10000000-0000-4000-8000-000000000002'),
  'permission denied', 'escrita direta na tabela é negada: só pelas RPCs');

-- ── inativar selecionados / todos ───────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.inativar_registros_alergia(%L, NULL, %L)', ARRAY[pg_temp.u('a2')], 'errado'),
  'Diga por que', 'inativar exige motivo (mínimo de 10 letras)');
SELECT pg_temp.confere(public.inativar_registros_alergia(ARRAY[pg_temp.u('a2')], ARRAY[pg_temp.u('e2')], 'registrado no paciente errado') = 2,
  'inativar selecionados: alergia e evento juntos');
SELECT pg_temp.falha(format('SELECT public.inativar_registros_alergia(%L, %L, %L)', ARRAY[pg_temp.u('a1')], ARRAY[pg_temp.u('e2')], 'já inativo antes'),
  'Evento adverso não encontrado ou já inativo', 'tudo ou nada: um já inativo recusa o lote');
SELECT pg_temp.confere(public.estado_alergia(pg_temp.u('pac')) = 'tem', 'o lote recusado não inativou nada (Dipirona segue ativa)');
SELECT pg_temp.falha(format('SELECT public.evoluir_grau_evento(%L, 5)', pg_temp.u('e2')), 'Evento adverso não encontrado ou inativo', 'evento inativo não evolui');
SELECT public.inativar_registros_alergia(ARRAY[pg_temp.u('a1')], ARRAY[pg_temp.u('e1')], 'teste de provocação negativo');
SELECT pg_temp.confere(public.estado_alergia(pg_temp.u('pac')) = 'nao_registrada',
  'inativar tudo volta a "não registrada" (o "nega" antigo não ressuscita)');
SELECT pg_temp.confere((SELECT count(*) FROM public.alergias_paciente WHERE paciente_id = pg_temp.u('pac')) = 2
  AND (SELECT bool_and(inativada_em IS NOT NULL AND inativada_por IS NOT NULL AND motivo_inativacao <> '') FROM public.alergias_paciente WHERE paciente_id = pg_temp.u('pac')),
  'inativadas continuam no banco, com quem, quando e por quê');
INSERT INTO t SELECT 'nega3', public.registrar_nega_alergia(pg_temp.u('pac'));
SELECT pg_temp.confere(public.estado_alergia(pg_temp.u('pac')) = 'nega', 'sem alergia ativa, "nega" volta a ser aceito');
INSERT INTO t SELECT 'painel', public.alergias_do_paciente(pg_temp.u('pac'))::text;
SELECT pg_temp.confere((SELECT p ->> 'estado' = 'nega'
    AND jsonb_array_length(p -> 'alergias') = 2 AND jsonb_array_length(p -> 'eventos') = 2 AND jsonb_array_length(p -> 'negacoes') = 3
    AND p -> 'negacoes' -> 0 ->> 'autor' = 'Enfermeira de Teste' AND p -> 'negacoes' -> 0 ->> 'encerrada_em' IS NULL -- a vigente vem primeiro
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'eventos') e
                WHERE e ->> 'evento' = 'Exantema' AND jsonb_array_length(e -> 'graus') = 3 AND e ->> 'inativado_por' = 'Enfermeira de Teste')
  FROM (SELECT valor::jsonb AS p FROM t WHERE nome = 'painel') x),
  'painel: estado, alergias e eventos com histórico e nome de quem registrou');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.alergias_do_paciente(%L)', pg_temp.u('pac')), 'Acesso negado', 'fora do plantão não lê o painel');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'i3', public.prescrever(pg_temp.u('pac'),
  json_build_object('medicamento_id', pg_temp.u('dip'), 'dose', '1 g', 'via', 'EV', 'posologia', '6/6h')::jsonb);
SELECT pg_temp.confere(pg_temp.u('i3') IS NOT NULL, 'alergia inativada com motivo deixa de travar (a regra da fase 4, intacta)');
RESET ROLE;

-- ── nada se apaga ───────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alergias_paciente', 'alergias_negacoes', 'eventos_adversos', 'eventos_adversos_graus'] LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE paciente_id = %L', t, pg_temp.u('pac'));
      RAISE EXCEPTION 'FALHOU: DELETE em % passou', t;
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE 'Registro clínico não se apaga%' THEN RAISE; END IF;
    END;
  END LOOP;
  RAISE NOTICE 'OK  alergias, "nega", eventos e histórico de grau não saem por DELETE (guarda de 20 anos)';
  BEGIN
    UPDATE public.eventos_adversos_graus SET grau = 1 WHERE evento_id = pg_temp.u('e1');
    RAISE EXCEPTION 'FALHOU: histórico de grau alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%só de inserção%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  histórico de grau é só de inserção';
END $$;
ROLLBACK;
