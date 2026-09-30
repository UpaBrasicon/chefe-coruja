-- Testes dos cuidados de enfermagem (migration 20261005000005). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_cuidados_enfermagem.sql
-- Regras: SAE só do enfermeiro, versionada por atendimento (episódio no PS,
-- internação na observação); dispositivo, balanço e curativo da enfermagem
-- (enfermeiro ou técnico) de plantão; validações de data e volume; retirada e
-- cancelamento uma vez, com motivo onde pede; nada se altera fora disso e
-- nada se apaga; leitura do painel e texto dos dispositivos para a evolução.
BEGIN;
-- médico (…0002) e enfermeira (…0004) no PS e na Observação; recepção
-- (…0005) no PS, que aqui também recebe o papel de técnico de enfermagem.
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', s, p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['22000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000002']::uuid[]) s,
     unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
                  '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'tecnico_enfermagem')
ON CONFLICT DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo) VALUES ('22000000-0000-4000-8000-000000000002', 'Box Cuidados', 'observacao');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated, anon;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated, anon;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';

-- ── paciente chega e é triado (PS, sem internação) ──────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Edema', NULL,
  '{"nome":"Porte Cuidados","data_nascimento":"1960-03-03"}') ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.5,"saturacao-o2":98,"escala-dor":2,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  pg_temp.u('flx'), 'Edema de face');
RESET ROLE;
INSERT INTO t SELECT 'p', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');

-- ── SAE ─────────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.registrar_sae(%L, %L, NULL, NULL, NULL, NULL, %L)', pg_temp.u('p'), 'histórico', pg_temp.u('ep')),
  'A SAE é do enfermeiro', 'técnico não registra SAE');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_sae(%L, %L, NULL, NULL, NULL, NULL, %L)', pg_temp.u('p'), 'histórico', pg_temp.u('ep')),
  'A SAE é do enfermeiro', 'médico não registra SAE');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.registrar_sae(%L, %L, %L, NULL, NULL, %L, %L)', pg_temp.u('p'), ' ', '[]', '', pg_temp.u('ep')),
  'Preencha ao menos uma etapa', 'SAE vazia não passa');
SELECT pg_temp.falha(format('SELECT public.registrar_sae(%L, %L, %L, NULL, NULL, NULL, %L)', pg_temp.u('p'), 'histórico',
  '[{"codigo":"00132","titulo":""}]', pg_temp.u('ep')),
  'Diagnósticos: cada item precisa do título', 'diagnóstico sem título da licença não passa');
SELECT public.registrar_sae(pg_temp.u('p'), 'Entrevista e exame físico: edema de face há 2 dias.',
  '[{"codigo":"00132","titulo":"Dor aguda","detalhe":"relacionada a agente lesivo"}]', NULL, NULL, NULL, pg_temp.u('ep'));
SELECT public.registrar_sae(pg_temp.u('p'), 'Entrevista e exame físico: edema de face há 2 dias.',
  '[{"codigo":" 00132 ","titulo":" Dor aguda ","detalhe":"relacionada a agente lesivo"}]',
  '[{"codigo":"2102","titulo":"Nível de dor","detalhe":"dor até 3 em 24 h"}]',
  '[{"codigo":"1400","titulo":"Controle da dor","detalhe":"avaliar a dor a cada 4 h"}]', 'Refere melhora.', pg_temp.u('ep'));
INSERT INTO t SELECT 'ps', public.cuidados_enfermagem(pg_temp.u('p'), pg_temp.u('ep'))::text;
RESET ROLE;
DO $$
DECLARE c jsonb := pg_temp.v('ps')::jsonb;
BEGIN
  IF (c -> 'sae' ->> 'versao')::int <> 2 OR c -> 'sae' ->> 'evolucao' <> 'Refere melhora.' THEN RAISE EXCEPTION 'FALHOU: SAE vigente (%)', c -> 'sae'; END IF;
  RAISE NOTICE 'OK  a SAE salva de novo vira versão 2, e a vigente é a última';
  IF c -> 'sae' -> 'diagnosticos' -> 0 ->> 'codigo' <> '00132' OR c -> 'sae' -> 'diagnosticos' -> 0 ->> 'titulo' <> 'Dor aguda' THEN
    RAISE EXCEPTION 'FALHOU: itens da SAE sem aparar (%)', c -> 'sae' -> 'diagnosticos';
  END IF;
  RAISE NOTICE 'OK  código e título da licença guardados como digitados (aparados)';
  IF (SELECT count(*) FROM public.sae_registros WHERE episodio_id = pg_temp.u('ep') AND internacao_id IS NULL) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: SAE do PS não ficou no episódio';
  END IF;
  RAISE NOTICE 'OK  no PS sem internação a SAE fica no episódio';
  IF NOT (c ->> 'pode_sae')::boolean OR NOT (c ->> 'pode_registrar')::boolean THEN RAISE EXCEPTION 'FALHOU: permissões da enfermeira'; END IF;
  RAISE NOTICE 'OK  a enfermeira de plantão pode registrar e editar a SAE';
END $$;

-- ── dispositivos ────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_dispositivo(%L, %L, %L, %L, %L)', pg_temp.u('p'), 'Acesso venoso periférico', 'MSE', '20G',
  private.data_atual()), 'Este registro é da enfermagem', 'médico não registra dispositivo pelo painel da enfermagem');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.registrar_dispositivo(%L, %L, %L, %L, %L)', pg_temp.u('p'), 'Curativo', 'MSE', '', private.data_atual()),
  'Escolha o tipo de dispositivo', 'tipo fora da lista não passa (curativo tem registro próprio)');
SELECT pg_temp.falha(format('SELECT public.registrar_dispositivo(%L, %L, %L, %L, %L)', pg_temp.u('p'), 'Acesso venoso periférico', 'MSE', '20G',
  private.data_atual() + 1), 'A inserção não pode ser no futuro', 'inserção no futuro não passa');
SELECT pg_temp.falha(format('SELECT public.registrar_dispositivo(%L, %L, %L, %L, %L, %L)', pg_temp.u('p'), 'Acesso venoso periférico', 'MSE', '20G',
  private.data_atual(), private.data_atual() - 1), 'A troca prevista não pode ser antes', 'troca prevista antes da inserção não passa');
INSERT INTO t SELECT 'avp', public.registrar_dispositivo(pg_temp.u('p'), 'Acesso venoso periférico', ' MSE ', '20G', private.data_atual() - 2,
  private.data_atual() + 2, NULL, pg_temp.u('ep'));
INSERT INTO t SELECT 'svd', public.registrar_dispositivo(pg_temp.u('p'), 'Sonda vesical de demora', '', '14 Fr', private.data_atual(),
  NULL, 'débito claro', pg_temp.u('ep'));
RESET ROLE;
DO $$
DECLARE x jsonb := private.dispositivos_em_uso_texto(pg_temp.u('p'));
BEGIN
  IF x <> '["Acesso venoso periférico · MSE · 20G (D3)", "Sonda vesical de demora · 14 Fr (D1)"]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: texto dos dispositivos para a evolução (%)', x;
  END IF;
  RAISE NOTICE 'OK  leitura para a evolução: "tipo · local · calibre (Dn)", D1 no dia da inserção';
  BEGIN
    UPDATE public.dispositivos_enfermagem SET local = 'MSD' WHERE id = pg_temp.u('avp');
    RAISE EXCEPTION 'FALHOU: dispositivo alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%só a retirada ou o cancelamento%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  dispositivo não se altera fora da retirada';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.retirar_dispositivo(pg_temp.u('avp'), 'flebite');
SELECT pg_temp.falha(format('SELECT public.retirar_dispositivo(%L)', pg_temp.u('avp')), 'Dispositivo já retirado', 'retirar duas vezes não passa');
RESET ROLE;
DO $$
BEGIN
  IF private.dispositivos_em_uso_texto(pg_temp.u('p')) <> '["Sonda vesical de demora · 14 Fr (D1)"]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: retirado continua em uso';
  END IF;
  RAISE NOTICE 'OK  o retirado sai da lista em uso da evolução';
  IF (SELECT motivo_retirada FROM public.dispositivos_enfermagem WHERE id = pg_temp.u('avp')) <> 'flebite' THEN
    RAISE EXCEPTION 'FALHOU: motivo da retirada';
  END IF;
  RAISE NOTICE 'OK  a retirada guarda quem, quando e o motivo';
END $$;

-- ── balanço hídrico ─────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.lancar_balanco(%L, %L, %L, %L)', pg_temp.u('p'), 'entrada', 'SF 0,9%%', 0),
  'Volume em mL', 'volume zero não passa');
SELECT pg_temp.falha(format('SELECT public.lancar_balanco(%L, %L, %L, %L)', pg_temp.u('p'), 'outro', 'SF 0,9%%', 100),
  'Escolha entrada ou saída', 'tipo fora de entrada/saída não passa');
SELECT pg_temp.falha(format('SELECT public.lancar_balanco(%L, %L, %L, %L, %L)', pg_temp.u('p'), 'entrada', 'SF', 100, now() + interval '1 hour'),
  'A hora não pode ser no futuro', 'lançamento no futuro não passa');
SELECT pg_temp.falha(format('SELECT public.lancar_balanco(%L, %L, %L, %L, %L)', pg_temp.u('p'), 'entrada', 'SF', 100, now() - interval '25 hours'),
  'Lançamento com mais de 24 h', 'lançamento com mais de 24 h não passa');
INSERT INTO t SELECT 'e1', public.lancar_balanco(pg_temp.u('p'), 'entrada', 'SF 0,9%', 500, now() - interval '2 hours', pg_temp.u('ep'));
INSERT INTO t SELECT 's1', public.lancar_balanco(pg_temp.u('p'), 'saida', 'Diurese', 300, NULL, pg_temp.u('ep'));
INSERT INTO t SELECT 'e2', public.lancar_balanco(pg_temp.u('p'), 'entrada', 'Dieta oral', 200.04, NULL, pg_temp.u('ep'));
SELECT pg_temp.falha(format('SELECT public.cancelar_balanco(%L, %L)', pg_temp.u('e2'), 'errado'), 'Diga por que', 'cancelar sem motivo não passa');
SELECT public.cancelar_balanco(pg_temp.u('e2'), 'lançado no paciente errado');
SELECT pg_temp.falha(format('SELECT public.cancelar_balanco(%L, %L)', pg_temp.u('e2'), 'lançado no paciente errado'),
  'Lançamento não encontrado ou já cancelado', 'cancelar duas vezes não passa');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT volume_ml FROM public.balanco_hidrico WHERE id = pg_temp.u('e2')) <> 200.0 THEN RAISE EXCEPTION 'FALHOU: arredondamento do volume'; END IF;
  RAISE NOTICE 'OK  volume guardado com uma casa';
  IF (SELECT cancelado_em IS NULL FROM public.balanco_hidrico WHERE id = pg_temp.u('e2')) THEN RAISE EXCEPTION 'FALHOU: cancelamento'; END IF;
  RAISE NOTICE 'OK  o cancelado continua no histórico, com motivo';
  BEGIN
    UPDATE public.balanco_hidrico SET volume_ml = 900 WHERE id = pg_temp.u('e1');
    RAISE EXCEPTION 'FALHOU: balanço alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%só a retirada ou o cancelamento%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  lançamento de balanço não se altera fora do cancelamento';
END $$;

-- ── curativos ───────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.registrar_curativo(%L, %L, %L, %L)', pg_temp.u('p'), '', 'Gaze', 'limpo'),
  'Informe o local', 'curativo sem local não passa');
SELECT pg_temp.falha(format('SELECT public.registrar_curativo(%L, %L, %L, %L, %L)', pg_temp.u('p'), 'Sacral', 'Hidrocoloide', 'limpo',
  private.data_atual() - 1), 'A próxima troca não pode ser antes de hoje', 'próxima troca no passado não passa');
INSERT INTO t SELECT 'cur', public.registrar_curativo(pg_temp.u('p'), 'Região sacral', 'Hidrocoloide', 'Leito com granulação, sem exsudato',
  private.data_atual() + 3, NULL, pg_temp.u('ep'));
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.curativos_enfermagem SET aspecto = 'outro' WHERE id = pg_temp.u('cur');
    RAISE EXCEPTION 'FALHOU: curativo alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%só de inserção%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  curativo é só de inserção: cada troca é um registro novo';
END $$;

-- ── leitura do painel ───────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'med', public.cuidados_enfermagem(pg_temp.u('p'), pg_temp.u('ep'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'tec', public.cuidados_enfermagem(pg_temp.u('p'), pg_temp.u('ep'))::text;
RESET ROLE;
DO $$
DECLARE m jsonb := pg_temp.v('med')::jsonb; c jsonb := pg_temp.v('tec')::jsonb;
BEGIN
  IF (m ->> 'pode_registrar')::boolean OR (m ->> 'pode_sae')::boolean THEN RAISE EXCEPTION 'FALHOU: médico com permissão da enfermagem'; END IF;
  RAISE NOTICE 'OK  o médico lê os cuidados, mas não registra pelo painel da enfermagem';
  IF NOT (c ->> 'pode_registrar')::boolean OR (c ->> 'pode_sae')::boolean THEN RAISE EXCEPTION 'FALHOU: permissões do técnico (%)', c; END IF;
  RAISE NOTICE 'OK  o técnico registra cuidados, mas não a SAE';
  IF jsonb_array_length(c -> 'dispositivos') <> 2 OR c -> 'dispositivos' -> 0 ->> 'tipo' <> 'Sonda vesical de demora'
     OR (c -> 'dispositivos' -> 1 ->> 'retirado_em') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: dispositivos no painel (%)', c -> 'dispositivos';
  END IF;
  RAISE NOTICE 'OK  o painel lista os em uso primeiro e mostra o retirado';
  IF jsonb_array_length(c -> 'balanco') <> 3 OR jsonb_array_length(c -> 'curativos') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: balanço e curativos no painel';
  END IF;
  RAISE NOTICE 'OK  o painel traz os lançamentos de 48 h (com o cancelado) e os curativos';
  IF jsonb_array_length(c -> 'sinais_vitais') < 1 OR (c -> 'sinais_vitais' -> 0 -> 'valores' ->> 'frequencia-cardiaca')::numeric <> 90 THEN
    RAISE EXCEPTION 'FALHOU: sinais vitais da triagem no painel (%)', c -> 'sinais_vitais';
  END IF;
  RAISE NOTICE 'OK  o painel mostra as últimas aferições (a da triagem entra)';
END $$;

-- ── na observação a SAE vai para a internação ───────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep')), public.registrar_soap(pg_temp.u('ep'), 'queixa', 'exame', 'avaliacao', 'plano', 'R60');
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'observacao');
RESET ROLE;
INSERT INTO t SELECT 'i', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.registrar_sae(pg_temp.u('p'), 'Admissão na observação.', NULL, NULL, NULL, NULL, pg_temp.u('ep'));
INSERT INTO t SELECT 'obs', public.cuidados_enfermagem(pg_temp.u('p'), pg_temp.u('ep'))::text;
INSERT INTO t SELECT 'sem', public.cuidados_enfermagem(pg_temp.u('p'))::text;
RESET ROLE;
DO $$
DECLARE c jsonb := pg_temp.v('obs')::jsonb;
BEGIN
  IF (SELECT internacao_id FROM public.sae_registros WHERE avaliacao = 'Admissão na observação.') IS DISTINCT FROM pg_temp.u('i') THEN
    RAISE EXCEPTION 'FALHOU: SAE da observação fora da internação';
  END IF;
  RAISE NOTICE 'OK  com a internação aberta do episódio, a SAE vai para ela';
  IF c ->> 'internacao_id' <> pg_temp.v('i') OR (c -> 'sae' ->> 'versao')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: painel da observação (%)', c -> 'sae';
  END IF;
  RAISE NOTICE 'OK  o painel pelo episódio acha a internação e a SAE dela (versão 1)';
  IF pg_temp.v('sem')::jsonb ->> 'internacao_id' <> pg_temp.v('i') OR NOT (pg_temp.v('sem')::jsonb ->> 'pode_registrar')::boolean THEN
    RAISE EXCEPTION 'FALHOU: painel sem atendimento informado (%)', pg_temp.v('sem');
  END IF;
  RAISE NOTICE 'OK  sem episódio nem internação informados, o painel acha o atendimento aberto';
END $$;

-- ── anon e guarda ───────────────────────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT pg_temp.falha(format('SELECT public.cuidados_enfermagem(%L)', pg_temp.u('p')), 'permission denied', 'anon não lê os cuidados');
SELECT pg_temp.falha(format('SELECT public.lancar_balanco(%L, %L, %L, %L)', pg_temp.u('p'), 'entrada', 'SF', 100), 'permission denied',
  'anon não lança balanço');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('INSERT INTO public.balanco_hidrico (unidade_id, paciente_id, episodio_id, tipo, descricao, volume_ml, aferido_em, registrado_por) VALUES (%L, %L, %L, %L, %L, 1, now(), %L)',
  '21000000-0000-4000-8000-000000000001', pg_temp.u('p'), pg_temp.u('ep'), 'entrada', 'direto', '10000000-0000-4000-8000-000000000004'),
  'permission denied', 'escrita direta na tabela não passa (só pela RPC)');
RESET ROLE;
DO $$
DECLARE tb text;
BEGIN
  FOREACH tb IN ARRAY ARRAY['sae_registros', 'dispositivos_enfermagem', 'balanco_hidrico', 'curativos_enfermagem'] LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE paciente_id = %L', tb, pg_temp.u('p'));
      RAISE EXCEPTION 'FALHOU: DELETE em %', tb;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  RAISE NOTICE 'OK  nada dos cuidados sai por DELETE (guarda de 20 anos)';
END $$;
ROLLBACK;
