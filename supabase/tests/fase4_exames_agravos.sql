-- Testes da migration 20260929000007_fase4_exames_agravos.sql. ROLLBACK no fim.
BEGIN;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
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

-- dois pacientes: A fica na porta (alta), B vai para a observação (internação)
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ea', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL, '{"nome":"Exame Porta","data_nascimento":"1981-01-01"}'::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'eb', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL, '{"nome":"Exame Leito","data_nascimento":"1982-01-01"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u(x), 'verde',
  '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.6,"saturacao-o2":98,"escala-dor":3,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face')
FROM unnest(ARRAY['ea', 'eb']) x;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u(x)), public.registrar_soap(pg_temp.u(x), 'dor', 'exame', 'aval', 'plano', 'R52') FROM unnest(ARRAY['ea', 'eb']) x;
SELECT public.registrar_desfecho(pg_temp.u('eb'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'pa', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ea');
INSERT INTO t SELECT 'pb', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('eb');
INSERT INTO t SELECT 'ib', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('eb');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.emitir_documento(pg_temp.u('pa'), 'pedido_exames', '{"pedido":{"texto":"- Hemograma\n- PCR\n"}}');
SELECT public.emitir_documento(pg_temp.u('pb'), 'pedido_exames', '{"exames":{"texto":"- Troponina"}}');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('ea'), 'alta'),
  'Alta: exames pedidos sem resultado: Hemograma, PCR', 'alta da porta espera o resultado dos exames pedidos');
SELECT public.resolver_exame((SELECT id FROM public.exames_pedidos WHERE paciente_id = pg_temp.u('pa') AND exame = 'Hemograma'), 'Hb 13,2; leuco 8.900');
SELECT pg_temp.falha(format('SELECT public.resolver_exame(%L, NULL, %L)', (SELECT id FROM public.exames_pedidos WHERE paciente_id = pg_temp.u('pa') AND exame = 'PCR'), 'curto'),
  'Registre o resultado, ou cancele com motivo', 'cancelar exame exige motivo');
SELECT public.resolver_exame((SELECT id FROM public.exames_pedidos WHERE paciente_id = pg_temp.u('pa') AND exame = 'PCR'), NULL, 'amostra hemolisada, sem nova coleta');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.marcar_agravo(%L, %L)', pg_temp.u('pa'), 'Dengue'), 'A suspeita de agravo é marcada pelo médico',
  'a suspeita de agravo é do médico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'ag', public.marcar_agravo(pg_temp.u('pa'), 'Dengue', 'a90');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L)', pg_temp.u('ea'), 'alta'),
  'Alta: agravo suspeito sem notificação registrada: Dengue', 'agravo suspeito sem notificação impede a alta');
SELECT pg_temp.falha(format('SELECT public.resolver_agravo(%L, false, NULL, %L)', pg_temp.u('ag'), 'não'),
  'Descartar a suspeita exige motivo', 'descartar a suspeita exige motivo');
SELECT public.resolver_agravo(pg_temp.u('ag'), true, '1234567');
SELECT public.registrar_desfecho(pg_temp.u('ea'), 'alta');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.exames_pedidos WHERE paciente_id = pg_temp.u('pa')) <> 2 THEN RAISE EXCEPTION 'FALHOU: linhas do pedido'; END IF;
  RAISE NOTICE 'OK  cada linha do pedido emitido vira um exame pedido';
  IF (SELECT desfecho FROM public.episodios WHERE id = pg_temp.u('ea')) <> 'alta'
     OR (SELECT cid FROM public.agravos_notificacao WHERE id = pg_temp.u('ag')) <> 'A90'
     OR (SELECT numero_sinan FROM public.agravos_notificacao WHERE id = pg_temp.u('ag')) <> '1234567' THEN
    RAISE EXCEPTION 'FALHOU: alta depois de resolver exames e agravo';
  END IF;
  RAISE NOTICE 'OK  com resultado, cancelamento motivado e notificação registrada, a alta passa';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(private.impeditivos_alta(pg_temp.u('ib'))) x
                  WHERE x ->> 'tipo' = 'exame' AND x ->> 'descricao' = 'Exame sem resultado: Troponina') THEN
    RAISE EXCEPTION 'FALHOU: exame como impeditivo da internação';
  END IF;
  RAISE NOTICE 'OK  na internação, exame sem resultado aparece nos impeditivos de alta';
END $$;
ROLLBACK;
