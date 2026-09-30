-- Testes das telas da enfermagem (migration 20261005000006). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_telas_enfermagem.sql
-- Lista por leito só dos setores da escala (sem os de observação), aprazamento
-- atrasado (tolerância de 2 horas, checagem do horário resolve), pendências do
-- turno, passagem da enfermagem leito a leito: todos os pacientes do setor
-- com texto, retrato das pendências em cada leito, receber uma vez por outra
-- pessoa da enfermagem do setor, sem alterar nem apagar.
BEGIN;
-- médico (…0002) e enfermeira (…0004) na Clínica Médica agora; a recepção
-- (…0005) ganha também o vínculo de técnico de enfermagem e fica na Clínica
-- Médica; a enfermeira fica ainda na Observação.
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'tecnico_enfermagem')
ON CONFLICT DO NOTHING;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
-- check-in dos plantões em curso: sem ele, passada a tolerância, a escala não abre a porta (20261014000001)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Dipirona', 'dipirona', 'comprimido 500 mg', 'teste-telas-enf');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT 'dipirona', id::text FROM public.medicamento WHERE fonte = 'teste-telas-enf';
-- horário aprazado 3 horas atrás, outro daqui a 2 horas e um de 1 hora atrás,
-- ainda dentro da tolerância de 2 horas (Brasília)
INSERT INTO t VALUES ('h_passou', to_char((now() - interval '3 hours') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')),
                     ('h_futuro', to_char((now() + interval '2 hours') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')),
                     ('h_tolerancia', to_char((now() - interval '1 hour') AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'));
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated;
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

-- ── prescrição no Paciente Fictício Um (internado na Clínica Médica) ────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'it', public.prescrever('23000000-0000-4000-8000-000000000001', json_build_object('medicamento_id', pg_temp.u('dipirona'),
  'dose', '1 comprimido', 'via', 'VO', 'posologia', '6/6h')::jsonb);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.aprazar(pg_temp.u('it'), ARRAY[pg_temp.v('h_passou'), pg_temp.v('h_futuro'), pg_temp.v('h_tolerancia')]);
RESET ROLE;
-- o item existe desde antes dos horários (na transação, now() é fixo)
UPDATE public.prescricao_itens SET created_at = now() - interval '5 hours' WHERE id = pg_temp.u('it');

-- ── quem vê a lista por leito ───────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT * FROM public.enfermagem_leitos('21000000-0000-4000-8000-000000000001')$$,
  'Acesso negado: tela da enfermagem', 'o médico não abre a lista da enfermagem');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'leitos', jsonb_agg(to_jsonb(x))::text FROM public.enfermagem_leitos('21000000-0000-4000-8000-000000000001') x;
INSERT INTO t SELECT 'pend1', count(*)::text FROM public.enfermagem_pendencias('21000000-0000-4000-8000-000000000001') x
  WHERE x.item_id = pg_temp.u('it');
RESET ROLE;
DO $$
DECLARE l jsonb := pg_temp.v('leitos')::jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(l) x WHERE x ->> 'setor_id' <> '22000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: a lista por leito trouxe setor fora da internação da escala (%)', l;
  END IF;
  RAISE NOTICE 'OK  a lista por leito traz só a Clínica Médica (a Observação fica no Pronto Socorro da enfermagem)';
  IF (SELECT count(*) FROM jsonb_array_elements(l) x WHERE x ->> 'paciente_id' IN ('23000000-0000-4000-8000-000000000001',
        '23000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000003')) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: os três internados do seed (%)', l;
  END IF;
  RAISE NOTICE 'OK  os internados da Clínica Médica aparecem por leito';
  IF (SELECT (x ->> 'aprazamentos_atrasados')::int FROM jsonb_array_elements(l) x
       WHERE x ->> 'paciente_id' = '23000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: um aprazamento atrasado (o de 3 horas atrás; o futuro e o de 1 hora não) (%)', l;
  END IF;
  RAISE NOTICE 'OK  atrasado só o horário que passou há mais de 2 horas';
  IF pg_temp.v('pend1')::int <> 1 THEN RAISE EXCEPTION 'FALHOU: pendências do turno (%)', pg_temp.v('pend1'); END IF;
  RAISE NOTICE 'OK  as pendências do turno listam o item atrasado';
END $$;

-- ── técnico sem escala não vê; com escala vê ────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'n_tec', count(*)::text FROM public.enfermagem_leitos('21000000-0000-4000-8000-000000000001');
-- ── passagem: entregar (enfermeira), com o atraso ainda aberto ──────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
INSERT INTO t SELECT 'n_setor', count(*)::text FROM public.enfermagem_pacientes_do_setor('22000000-0000-4000-8000-000000000001');
-- o texto de cada paciente do setor; sem o do Paciente Fictício Um, falta
INSERT INTO t SELECT 'leitos_todos', jsonb_agg(jsonb_build_object('paciente_id', x.paciente_id, 'texto', 'Estável, sem intercorrências'))::text
  FROM public.enfermagem_pacientes_do_setor('22000000-0000-4000-8000-000000000001') x;
INSERT INTO t SELECT 'leitos_falta', jsonb_agg(jsonb_build_object('paciente_id', x.paciente_id, 'texto', 'Estável, sem intercorrências'))::text
  FROM public.enfermagem_pacientes_do_setor('22000000-0000-4000-8000-000000000001') x
 WHERE x.paciente_id <> '23000000-0000-4000-8000-000000000001';
SELECT pg_temp.falha(format('SELECT public.entregar_passagem_enfermagem(%L, %L::jsonb, %L)', '22000000-0000-4000-8000-000000000001',
  pg_temp.v('leitos_falta'), 'Falta equipo de bomba.'),
  'Falta a passagem de', 'a passagem vai leito a leito: nenhum paciente do setor fica sem');
SELECT pg_temp.falha($$SELECT public.entregar_passagem_enfermagem('22000000-0000-4000-8000-000000000003', '[]'::jsonb, 'Sem intercorrências no setor')$$,
  'A passagem é da enfermagem escalada neste setor agora', 'não passa plantão de setor em que não está escalada');
INSERT INTO t SELECT 'pass', public.entregar_passagem_enfermagem('22000000-0000-4000-8000-000000000001',
  pg_temp.v('leitos_todos')::jsonb, 'Falta equipo de bomba.');
SELECT pg_temp.falha(format('SELECT public.receber_passagem_enfermagem(%L)', pg_temp.u('pass')),
  'Quem entregou não recebe', 'quem entregou não recebe a própria');
-- o médico não recebe (não é enfermagem)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.receber_passagem_enfermagem(%L)', pg_temp.u('pass')),
  'Recebe a passagem a enfermagem', 'o médico não recebe a passagem da enfermagem');
INSERT INTO t SELECT 'n_pass_medico', count(*)::text FROM public.passagens_enfermagem;
-- o técnico recebe, uma vez
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.receber_passagem_enfermagem(pg_temp.u('pass'));
SELECT pg_temp.falha(format('SELECT public.receber_passagem_enfermagem(%L)', pg_temp.u('pass')),
  'Esta passagem já foi recebida', 'recebe-se uma vez');
INSERT INTO t SELECT 'lista', jsonb_agg(to_jsonb(x))::text FROM public.passagens_enfermagem_do_plantao('21000000-0000-4000-8000-000000000001') x
  WHERE x.id = pg_temp.u('pass');
SELECT pg_temp.falha(format('UPDATE public.passagens_enfermagem SET texto = %L WHERE id = %L', 'outro texto qualquer', pg_temp.u('pass')),
  'permission denied', 'o cliente não altera a passagem');
-- checar o horário resolve o atraso
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.checar(pg_temp.u('it'), 'feito', pg_temp.v('h_passou'));
INSERT INTO t SELECT 'depois', (SELECT x.aprazamentos_atrasados FROM public.enfermagem_leitos('21000000-0000-4000-8000-000000000001') x
  WHERE x.paciente_id = '23000000-0000-4000-8000-000000000001')::text;
RESET ROLE;

DO $$
DECLARE l jsonb := pg_temp.v('lista')::jsonb -> 0;
BEGIN
  IF pg_temp.v('n_tec')::int < 3 THEN RAISE EXCEPTION 'FALHOU: técnico escalado vê os leitos (%)', pg_temp.v('n_tec'); END IF;
  RAISE NOTICE 'OK  o técnico de enfermagem escalado vê a lista por leito';
  IF pg_temp.v('n_pass_medico')::int <> 0 THEN RAISE EXCEPTION 'FALHOU: o médico leu a passagem da enfermagem'; END IF;
  RAISE NOTICE 'OK  a passagem da enfermagem não aparece para o médico';
  IF l ->> 'recebida_por_nome' IS NULL OR l ->> 'entregue_por_nome' <> 'Enfermeira de Teste' OR l ->> 'turno' <> 'manha' THEN
    RAISE EXCEPTION 'FALHOU: passagem recebida com nomes e turno (%)', l;
  END IF;
  RAISE NOTICE 'OK  a passagem traz quem entregou, o turno e quem recebeu';
  IF jsonb_array_length(l -> 'pendencias') <> 1 OR l -> 'pendencias' -> 0 ->> 'horario' <> pg_temp.v('h_passou') THEN
    RAISE EXCEPTION 'FALHOU: retrato das pendências na entrega (%)', l -> 'pendencias';
  END IF;
  RAISE NOTICE 'OK  a entrega guarda o retrato das pendências do turno';
  IF jsonb_array_length(l -> 'leitos') <> pg_temp.v('n_setor')::int OR pg_temp.v('n_setor')::int < 3 THEN
    RAISE EXCEPTION 'FALHOU: um leito por paciente do setor (% de %)', jsonb_array_length(l -> 'leitos'), pg_temp.v('n_setor');
  END IF;
  IF (SELECT jsonb_array_length(x -> 'pendencias') FROM jsonb_array_elements(l -> 'leitos') x
       WHERE x ->> 'paciente_id' = '23000000-0000-4000-8000-000000000001') <> 1
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(l -> 'leitos') x
                 WHERE x ->> 'paciente_id' <> '23000000-0000-4000-8000-000000000001' AND jsonb_array_length(x -> 'pendencias') <> 0)
     OR l ->> 'texto' <> 'Falta equipo de bomba.' THEN
    RAISE EXCEPTION 'FALHOU: leito a leito, com as pendências de cada um e a observação geral (%)', l -> 'leitos';
  END IF;
  RAISE NOTICE 'OK  a passagem vai leito a leito, cada leito com as suas pendências';
  IF pg_temp.v('depois')::int <> 0 THEN RAISE EXCEPTION 'FALHOU: checar o horário resolve o atraso (%)', pg_temp.v('depois'); END IF;
  RAISE NOTICE 'OK  checar o horário tira o atraso';
  BEGIN
    UPDATE public.passagens_enfermagem SET texto = 'texto trocado depois' WHERE id = pg_temp.u('pass');
    RAISE EXCEPTION 'FALHOU: passagem alterada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Esta passagem já foi recebida%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  a passagem recebida não se altera';
  BEGIN
    DELETE FROM public.passagens_enfermagem WHERE id = pg_temp.u('pass');
    RAISE EXCEPTION 'FALHOU: passagem apagada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK  a passagem não se apaga (guarda de 20 anos)';
  -- o gestor tira o plantão da escala: a passagem fica, com turno e data
  DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000004'
     AND setor_id = '22000000-0000-4000-8000-000000000001';
  IF NOT EXISTS (SELECT 1 FROM public.passagens_enfermagem WHERE id = pg_temp.u('pass')
                   AND plantao_id IS NULL AND turno = 'manha' AND data = private.data_atual() AND recebida_em IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU: plantão apagado da escala deixa a passagem com turno e data';
  END IF;
  RAISE NOTICE 'OK  apagar o plantão da escala não trava nem apaga a passagem (turno e data ficam nela)';
END $$;
ROLLBACK;
