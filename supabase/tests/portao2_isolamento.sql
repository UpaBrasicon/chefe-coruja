-- Testes da migration 20261120000001_isolamento_trava_leito.sql (Correções do
-- Portão 2, tarefa 1: isolamento trava o leito). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/portao2_isolamento.sql
-- Um adulto com suspeita de tuberculose chega pela porta. A enfermeira marca
-- isolamento por aerossol; a escolha de leito só mostra leito de isolamento;
-- internar em leito comum, reservar leito comum e trocar para leito comum são
-- recusados; internar sem leito avisa o NIR; a marca sai com motivo e
-- termina sozinha na alta.
BEGIN;
-- Portão 2, tarefa 4: este teste escala a mesma pessoa em mais de um setor por
-- conveniência; a regra de sobreposição tem teste próprio (portao2_escala_sobreposicao.sql)
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

-- NIR da unidade (recebe o aviso) e um leito de isolamento na Clínica Médica
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000089', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'nir-isolamento@teste.local', '', now(), '{}', '{"nome_completo":"NIR Isolamento"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-000000000089', 'NIR Isolamento') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000089', '21000000-0000-4000-8000-000000000001', 'nir') ON CONFLICT DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, status, tipo)
VALUES ('22000000-0000-4000-8000-000000000001', 'ISO-T', 'livre', 'isolamento');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated, anon;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated, anon;
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
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_txt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_txt; END IF;
  RAISE NOTICE 'OK  %', p_txt;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated, anon;
INSERT INTO t SELECT 'flx', id::text FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto';
INSERT INTO t SELECT 'iso', id::text FROM public.leitos WHERE identificador = 'ISO-T';
INSERT INTO t SELECT 'comum', id::text FROM public.leitos WHERE setor_id = '22000000-0000-4000-8000-000000000001' AND identificador = '13A';

-- ── porta: ficha, classificação e atendimento ────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse há 3 semanas', NULL,
  json_build_object('nome', 'Paciente Isolamento Teste', 'data_nascimento', (current_date - interval '36 years')::date)::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":98,"frequencia-respiratoria":22,"temperatura":38.0,"saturacao-o2":94,"escala-dor":2,"pressao-arterial-sistolica":110,"pressao-arterial-diastolica":70}',
  pg_temp.u('flx'), 'Edema de face');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;

-- ── marcar: quem pode, motivo, duplicidade ───────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.marcar_isolamento(%L, %L, %L)', pg_temp.u('pac'), 'aerossol', 'Suspeita de tuberculose'),
  'O isolamento é marcado pelo médico ou pelo enfermeiro', 'recepção não marca isolamento');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.marcar_isolamento(%L, %L, %L)', pg_temp.u('pac'), 'aerossol', 'TB'),
  'Diga o motivo do isolamento', 'marca exige motivo');
SELECT pg_temp.falha(format('SELECT public.marcar_isolamento(%L, %L, %L)', pg_temp.u('pac'), 'reverso', 'Imunossuprimido grave'),
  'Escolha o tipo de isolamento', 'tipo fora da lista é recusado');
INSERT INTO t SELECT 'm1', public.marcar_isolamento(pg_temp.u('pac'), 'aerossol', 'Suspeita de tuberculose bacilífera');
SELECT pg_temp.falha(format('SELECT public.marcar_isolamento(%L, %L, %L)', pg_temp.u('pac'), 'aerossol', 'De novo, por engano'),
  'O paciente já está em isolamento por aerossol', 'mesmo tipo não é marcado duas vezes');
SELECT pg_temp.confere(jsonb_array_length(public.isolamento_do_paciente(pg_temp.u('pac'))) = 1, 'a tela lê o isolamento ativo');

-- ── escolha de leito e desfecho ──────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere(
  (SELECT array_agg(identificador) FROM public.leitos_para_ocupar('22000000-0000-4000-8000-000000000001', pg_temp.u('pac'))) = ARRAY['ISO-T'],
  'a escolha de leito mostra só o leito de isolamento');
SELECT public.iniciar_atendimento(pg_temp.u('ep')),
       public.registrar_soap(pg_temp.u('ep'), 'Tosse há 3 semanas, febre e emagrecimento', 'Crepitações em ápice',
                             'Suspeita de tuberculose pulmonar', 'Internar em isolamento respiratório', 'A15.0');
SELECT pg_temp.falha(format('SELECT public.registrar_desfecho(%L, %L, NULL, %L::jsonb)', pg_temp.u('ep'), 'internacao',
  json_build_object('setor_id', '22000000-0000-4000-8000-000000000001', 'leito_id', pg_temp.u('comum'))),
  'Paciente em isolamento por aerossol: o leito 13A não é de isolamento', 'internar em leito comum é recusado');
SELECT pg_temp.falha(format('SELECT public.reservar_leito(%L, 2, %L, NULL)', pg_temp.u('comum'), pg_temp.u('pac')),
  'Paciente em isolamento por aerossol: o leito 13A não é de isolamento', 'reservar leito comum para o paciente é recusado');
-- sem leito de isolamento livre: interna sem leito, aguardando, e o NIR é avisado
SELECT public.registrar_desfecho(pg_temp.u('ep'), 'internacao', NULL, '{"setor_id":"22000000-0000-4000-8000-000000000001"}');
RESET ROLE;
INSERT INTO t SELECT 'i', id::text FROM public.internacoes WHERE episodio_id = pg_temp.u('ep');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.notificacoes_plantonista
   WHERE perfil_id = '10000000-0000-4000-8000-000000000089' AND tipo = 'isolamento_' || pg_temp.u('i')
     AND mensagem LIKE '%aguarda leito de isolamento%'), 'NIR avisado: internado sem leito, aguardando isolamento');
SELECT pg_temp.confere((SELECT retirado_em IS NULL FROM public.isolamentos_paciente WHERE id = pg_temp.u('m1')),
  'a marca continua depois que a porta vira internação');
SET LOCAL ROLE authenticated;

-- ── troca de leito ───────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.registrar_evento_adt(%L, %L, %L, %L, %L)', pg_temp.u('i'), 'transferencia_leito',
  '22000000-0000-4000-8000-000000000001', pg_temp.u('comum'), 'Leito vago'),
  'Paciente em isolamento por aerossol', 'trocar para leito comum é recusado');
SELECT public.registrar_evento_adt(pg_temp.u('i'), 'transferencia_leito', '22000000-0000-4000-8000-000000000001', pg_temp.u('iso'), 'Isolamento respiratório');
RESET ROLE;
SELECT pg_temp.confere((SELECT leito_atual_id = pg_temp.u('iso') FROM public.internacoes WHERE id = pg_temp.u('i')), 'vai para o leito de isolamento');
SET LOCAL ROLE authenticated;

-- ── retirar e marcar de novo ────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.retirar_isolamento(%L, %L)', pg_temp.u('m1'), 'ok'),
  'Diga por que o isolamento sai', 'retirar exige motivo');
SELECT public.retirar_isolamento(pg_temp.u('m1'), 'Três baciloscopias negativas');
SELECT pg_temp.confere(jsonb_array_length(public.isolamento_do_paciente(pg_temp.u('pac'))) = 0, 'retirado com motivo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'm2', public.marcar_isolamento(pg_temp.u('pac'), 'contato', 'KPC em swab de vigilância');
SELECT pg_temp.confere((SELECT count(*) FROM public.leitos_para_ocupar('22000000-0000-4000-8000-000000000001', pg_temp.u('pac'))) = 0,
  'com o paciente no ISO-T e nenhum outro leito de isolamento livre, a escolha fica vazia');
RESET ROLE;
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'isolamento_marcado' AND entidade_id = pg_temp.u('m1'))
  AND EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'isolamento_retirado' AND entidade_id = pg_temp.u('m1')),
  'marcar e retirar ficam na auditoria');

-- ── alta encerra a marca ─────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.dar_alta(pg_temp.u('i'), 'alta_melhorada', 'A15.0');
RESET ROLE;
SELECT pg_temp.confere((SELECT retirado_em IS NOT NULL AND motivo_retirada = 'Encerrado com a alta da internação'
                          FROM public.isolamentos_paciente WHERE id = pg_temp.u('m2')), 'a alta encerra o isolamento');
SELECT pg_temp.confere(cardinality(private.isolamento_ativo(pg_temp.u('pac'))) = 0, 'sem isolamento ativo depois da alta');

ROLLBACK;
