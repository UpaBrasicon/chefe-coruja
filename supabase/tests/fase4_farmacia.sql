-- Testes da migration 20260929000008_fase4_farmacia.sql. ROLLBACK no fim.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'farmaceutico') ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES ('Vancomicina', 'vancomicina', 'pó 500 mg', 'teste-farmacia');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'van', id::text FROM public.medicamento WHERE fonte = 'teste-farmacia';
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

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL, '{"nome":"Farmacia Teste","data_nascimento":"1960-10-10"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'item', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('van'),
  'dose', '1 g', 'via', 'EV', 'posologia', '12/12h')::jsonb);
SELECT pg_temp.falha(format('SELECT * FROM public.fila_validacao(%L)', '21000000-0000-4000-8000-000000000001'),
  'A validação é do farmacêutico', 'só o farmacêutico vê a fila de validação');
SELECT pg_temp.falha(format('SELECT public.atualizar_estoque(%L, %L, 5)', '21000000-0000-4000-8000-000000000001', pg_temp.u('van')),
  'Estoque é do farmacêutico', 'só o farmacêutico mexe no estoque');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
INSERT INTO t SELECT 'fila1', (SELECT count(*) FROM public.fila_validacao('21000000-0000-4000-8000-000000000001') WHERE item_id = pg_temp.u('item'))::text;
SELECT pg_temp.falha(format('SELECT public.validar_item(%L, false, %L)', pg_temp.u('item'), 'curto'), 'Devolver para correção exige motivo',
  'devolver exige motivo');
SELECT public.validar_item(pg_temp.u('item'), false, 'dose sem ajuste para a função renal informada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'visto', (SELECT validacao || ':' || validacao_motivo FROM public.prescricao_vigente(pg_temp.u('pac')) WHERE id = pg_temp.u('item'));
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.validar_item(pg_temp.u('item'), true);
INSERT INTO t SELECT 'fila2', (SELECT count(*) FROM public.fila_validacao('21000000-0000-4000-8000-000000000001') WHERE item_id = pg_temp.u('item'))::text;
SELECT public.atualizar_estoque('21000000-0000-4000-8000-000000000001', pg_temp.u('van'), 5, 10, 3);
INSERT INTO t SELECT 'sit1', (SELECT situacao FROM public.disponibilidade('21000000-0000-4000-8000-000000000001') WHERE medicamento_id = pg_temp.u('van'));
SELECT public.atualizar_estoque('21000000-0000-4000-8000-000000000001', pg_temp.u('van'), 2);
INSERT INTO t SELECT 'sit2', (SELECT situacao FROM public.disponibilidade('21000000-0000-4000-8000-000000000001') WHERE medicamento_id = pg_temp.u('van'));
SELECT pg_temp.falha(format('SELECT public.atualizar_estoque(%L, %L, 5, 2, 4)', '21000000-0000-4000-8000-000000000001', pg_temp.u('van')),
  'O limite de falta não pode ser maior', 'limite de falta acima do crítico é recusado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'f1', public.sinalizar_falta('21000000-0000-4000-8000-000000000001', pg_temp.u('van'), 'acabou no carrinho');
INSERT INTO t SELECT 'f2', public.sinalizar_falta('21000000-0000-4000-8000-000000000001', pg_temp.u('van'));
SELECT pg_temp.falha(format('SELECT public.avancar_falta(%L, %L)', pg_temp.u('f1'), 'reposta'), 'Acompanhar a falta é do farmacêutico',
  'só o farmacêutico anda com a falta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.avancar_falta(pg_temp.u('f1'), 'em_cotacao');
SELECT pg_temp.falha(format('SELECT public.avancar_falta(%L, %L)', pg_temp.u('f1'), 'registrada'), 'A falta anda', 'a falta não volta atrás');
SELECT public.avancar_falta(pg_temp.u('f1'), 'reposta');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT valor FROM t WHERE nome = 'fila1')::int <> 1 OR (SELECT valor FROM t WHERE nome = 'fila2')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: fila de validação';
  END IF;
  RAISE NOTICE 'OK  item novo entra na fila; conferido, sai';
  IF (SELECT valor FROM t WHERE nome = 'visto') <> 'devolvido:dose sem ajuste para a função renal informada' THEN
    RAISE EXCEPTION 'FALHOU: devolução visível ao médico';
  END IF;
  RAISE NOTICE 'OK  a devolução aparece no item da prescrição do médico, com o motivo';
  IF (SELECT valor FROM t WHERE nome = 'sit1') <> 'critico' OR (SELECT valor FROM t WHERE nome = 'sit2') <> 'falta' THEN
    RAISE EXCEPTION 'FALHOU: selo de disponibilidade';
  END IF;
  RAISE NOTICE 'OK  o selo é a comparação com os limites (crítico e depois falta), mantendo os limites já definidos';
  IF pg_temp.u('f1') <> pg_temp.u('f2') OR (SELECT situacao FROM public.faltas_medicamento WHERE id = pg_temp.u('f1')) <> 'reposta' THEN
    RAISE EXCEPTION 'FALHOU: faltas';
  END IF;
  RAISE NOTICE 'OK  falta sinalizada de novo não duplica; anda Registrada → Em cotação → Reposta';
END $$;
ROLLBACK;
