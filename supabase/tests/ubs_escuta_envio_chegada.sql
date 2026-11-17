-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000002_ubs_escuta_envio_chegada.sql (percurso
-- da UBS, U8, U9 e D2). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. U8: sem enfermeiro de plantão, a ficha de escuta inicial vai direto ao
--    médico, e a ficha devolve a etapa; com enfermeiro, vai à escuta;
-- 2. U8: a escuta registra a DUM na classificação; DUM no futuro, com mais de
--    48 semanas ou de cadastro masculino é recusada;
-- 3. U9: a ficha aberta na UPA com o mesmo CNS marca a chegada sozinha e avisa
--    quem enviou; com dois envios possíveis, nada é marcado.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000072a1'),
  ('ubs',   '00000000-0000-4000-8000-0000000072a2'),
  ('cons',  '00000000-0000-4000-8000-0000000072a3'),
  ('cons2', '00000000-0000-4000-8000-0000000072a4'),
  ('upa',   '00000000-0000-4000-8000-0000000072a5'),
  ('porta', '00000000-0000-4000-8000-0000000072a6'),
  ('rec',   '00000000-0000-4000-8000-0000000072b1'),
  ('enf',   '00000000-0000-4000-8000-0000000072b2'),
  ('med',   '00000000-0000-4000-8000-0000000072b3'),
  ('recu',  '00000000-0000-4000-8000-0000000072b4');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
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
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE v (nome text PRIMARY KEY, valor jsonb) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS jsonb LANGUAGE sql AS $$ SELECT valor FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
CREATE FUNCTION pg_temp.ep(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT (valor ->> 'episodio_id')::uuid FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.ep(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u8.local' FROM ids WHERE nome IN ('rec', 'enf', 'med', 'recu');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('rec', 'enf', 'med', 'recu')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U8');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U8', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U8', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('cons2'), pg_temp.id('ubs'), 'Consultório 2', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'),
  (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'), (pg_temp.id('recu'), pg_temp.id('upa'), 'recepcao');
-- enfermeiro só no consultório 1; recepção e médico nos dois
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT u, s, pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), 'enf'), (pg_temp.id('ubs'), pg_temp.id('cons'), 'rec'),
               (pg_temp.id('ubs'), pg_temp.id('cons'), 'med'), (pg_temp.id('ubs'), pg_temp.id('cons2'), 'rec'),
               (pg_temp.id('upa'), pg_temp.id('porta'), 'recu')) x(u, s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id IN (pg_temp.id('ubs'), pg_temp.id('upa')) ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

-- ── 1. escuta sem enfermeiro vai ao médico ──────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'com_enf', public.registrar_ficha(pg_temp.id('cons'), 'Atraso menstrual', NULL,
  '{"nome":"Paciente U8 Um","data_nascimento":"1995-03-03","sexo":"F","tipo_atendimento":"escuta_inicial"}');
INSERT INTO v SELECT 'sem_enf', public.registrar_ficha(pg_temp.id('cons2'), 'Tosse', NULL,
  '{"nome":"Paciente U8 Dois","data_nascimento":"1970-04-04","tipo_atendimento":"escuta_inicial"}');
SELECT pg_temp.ok(pg_temp.v('com_enf') ->> 'etapa' = 'triagem', '1. com enfermeiro de plantão: a escuta vai à fila da enfermagem');
SELECT pg_temp.ok(pg_temp.v('sem_enf') ->> 'etapa' = 'atendimento', '1. sem enfermeiro de plantão: vai direto ao médico');
RESET ROLE;
SELECT pg_temp.ok((SELECT tipo_atendimento_aps = 'escuta_inicial' FROM public.episodios WHERE id = pg_temp.ep('sem_enf')),
  '1. o tipo de atendimento fica como a recepção escolheu');
SET LOCAL ROLE authenticated;

-- ── 2. DUM na escuta ────────────────────────────────────────────────────────
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.ep('com_enf'), 'verde', 'consulta', p_dum => current_date + 1)$$,
  'DUM no futuro', '2. DUM no futuro é recusada');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.ep('com_enf'), 'verde', 'consulta', p_dum => current_date - 400)$$,
  'DUM com mais de 48 semanas', '2. DUM com mais de 48 semanas é recusada');
SELECT public.registrar_escuta_aps(pg_temp.ep('com_enf'), 'verde', 'consulta', p_dum => current_date - 70);
RESET ROLE;
SELECT pg_temp.ok((SELECT (gestacao ->> 'dum')::date = current_date - 70 AND gestacao ->> 'origem' = 'escuta_aps'
                     FROM public.classificacoes_risco WHERE episodio_id = pg_temp.ep('com_enf')),
  '2. a DUM fica na classificação, onde o pré-natal a lê');
UPDATE public.pacientes SET sexo = 'M' WHERE id = (SELECT paciente_id FROM public.episodios WHERE id = pg_temp.ep('sem_enf'));
UPDATE public.episodios SET etapa = 'triagem', setor_id = pg_temp.id('cons') WHERE id = pg_temp.ep('sem_enf');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.falha($$SELECT public.registrar_escuta_aps(pg_temp.ep('sem_enf'), 'verde', 'consulta', p_dum => current_date - 30)$$,
  'DUM: o cadastro do paciente é do sexo masculino', '2. DUM em cadastro masculino é recusada');

-- ── 3. chegada na UPA pela ficha ────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'ep3', public.registrar_ficha(pg_temp.id('cons'), 'Dor no peito', NULL,
  '{"nome":"Paciente U9","data_nascimento":"1960-06-06","cns":"898001160000001","tipo_atendimento":"consulta_no_dia"}');
SELECT pg_temp.como('med');
SELECT public.iniciar_atendimento(pg_temp.ep('ep3'));
INSERT INTO v SELECT 'x3', to_jsonb(public.encaminhar_upa(pg_temp.ep('ep3'), pg_temp.id('upa'), 'Dor torácica, sem ECG na UBS'));
SELECT pg_temp.como('recu');
-- na UPA o nome vem escrito de outro jeito; o CNS liga
INSERT INTO v SELECT 'epu', public.registrar_ficha(pg_temp.id('porta'), 'Dor torácica', NULL,
  '{"nome":"PACIENTE U-9","data_nascimento":"1960-06-06","cns":"898001160000001"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT situacao = 'chegou' AND episodio_destino_id = pg_temp.ep('epu') AND chegada_por = pg_temp.id('recu')
                     FROM public.encaminhamentos_upa WHERE id = (pg_temp.v('x3') #>> '{}')::uuid),
  '3. a ficha da UPA com o mesmo CNS marca a chegada, ligada à ficha');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.notificacoes_plantonista WHERE perfil_id = pg_temp.id('med')
                     AND mensagem LIKE 'Paciente U9 chegou à UPA do U8%'), '3. quem enviou é avisado');

-- dois envios do mesmo paciente esperando: nada é marcado sozinho
INSERT INTO public.encaminhamentos_upa (organizacao_id, unidade_origem_id, episodio_origem_id, paciente_id, unidade_destino_id,
                                        motivo, resumo, enviado_por, prazo_em)
SELECT pg_temp.id('org'), pg_temp.id('ubs'), e.id, e.paciente_id, pg_temp.id('upa'), 'Envio de teste ' || e.queixa,
       jsonb_build_object('paciente', jsonb_build_object('nome', 'Paciente Duplo', 'data_nascimento', '1975-07-07')),
       pg_temp.id('med'), now() + interval '12 hours'
  FROM public.episodios e WHERE e.id IN (pg_temp.ep('com_enf'), pg_temp.ep('sem_enf'));  -- um envio aberto por episódio
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('recu');
INSERT INTO v SELECT 'epd', public.registrar_ficha(pg_temp.id('porta'), 'Febre', NULL,
  '{"nome":"Paciente Duplo","data_nascimento":"1975-07-07"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.encaminhamentos_upa WHERE motivo LIKE 'Envio de teste %' AND situacao = 'enviado'),
  '3. com dois envios possíveis, a recepção escolhe no painel');

ROLLBACK;
