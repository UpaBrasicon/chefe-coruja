-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000003_ubs_funcionamento.sql (percurso da UBS,
-- U3). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. sem horário salvo, nada muda; o gestor grava; outros papéis não;
-- 2. o horário não deixa de fora a grade da agenda nem a escala futura;
-- 3. com horário: grade e escala da UBS só dentro dele; a UPA não muda;
-- 4. a ficha não atendida vence uma hora depois do fechamento do dia.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000073a1'),
  ('ubs',   '00000000-0000-4000-8000-0000000073a2'),
  ('cons',  '00000000-0000-4000-8000-0000000073a3'),
  ('upa',   '00000000-0000-4000-8000-0000000073a4'),
  ('porta', '00000000-0000-4000-8000-0000000073a5'),
  ('ubs2',  '00000000-0000-4000-8000-0000000073a6'),
  ('cons2', '00000000-0000-4000-8000-0000000073a7'),
  ('ges',   '00000000-0000-4000-8000-0000000073b1'),
  ('med',   '00000000-0000-4000-8000-0000000073b2'),
  ('rec',   '00000000-0000-4000-8000-0000000073b3'),
  ('pac',   '00000000-0000-4000-8000-0000000073c1');
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
-- a próxima segunda e o sábado da mesma semana
CREATE FUNCTION pg_temp.segunda() RETURNS date LANGUAGE sql AS $$
  SELECT (date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::date) + interval '7 days')::date $$;
GRANT EXECUTE ON FUNCTION pg_temp.segunda() TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u3.local' FROM ids WHERE nome IN ('ges', 'med', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('ges', 'med', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U3');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U3', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U3', 'upa'),
  (pg_temp.id('ubs2'), pg_temp.id('org'), 'UBS 2 do U3', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('cons2'), pg_temp.id('ubs2'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('ges'), pg_temp.id('ubs'), 'gestor'), (pg_temp.id('med'), pg_temp.id('ubs'), 'plantonista'),
  (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao'), (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista');

SET LOCAL ROLE authenticated;

-- ── 1. sem horário, nada muda; quem grava ───────────────────────────────────
SELECT pg_temp.como('ges');
SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  '[{"dia": 1, "periodo": "manha", "inicio": "07:00", "fim": "11:00", "duracao": 20},
    {"dia": 1, "periodo": "noite", "inicio": "19:00", "fim": "22:00", "duracao": 20}]');
SELECT pg_temp.ok(jsonb_array_length(public.ubs_funcionamento(pg_temp.id('ubs'))) = 0, '1. sem horário salvo, a grade aceita a noite');
SELECT pg_temp.como('rec');
SELECT pg_temp.falha($$SELECT public.ubs_definir_funcionamento(pg_temp.id('ubs'), '[{"dia": 1, "abre": "07:00", "fecha": "19:00"}]')$$,
  'A configuração da agenda é do gestor', '1. a recepção não grava o horário');
SELECT pg_temp.ok(jsonb_array_length(public.ubs_funcionamento(pg_temp.id('ubs'))) = 0, '1. a recepção lê o horário');

-- ── 2. o horário não deixa nada de fora ─────────────────────────────────────
SELECT pg_temp.como('ges');
SELECT pg_temp.falha($$SELECT public.ubs_definir_funcionamento(pg_temp.id('ubs'),
  (SELECT jsonb_agg(jsonb_build_object('dia', d, 'abre', '07:00', 'fecha', '19:00')) FROM generate_series(1, 5) d))$$,
  'A grade da agenda de Pessoa med tem período fora deste horário', '2. a grade com noite impede o horário');
SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  '[{"dia": 1, "periodo": "manha", "inicio": "07:00", "fim": "11:00", "duracao": 20}]');
RESET ROLE;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('med'), pg_temp.segunda(), 'noite');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.ubs_definir_funcionamento(pg_temp.id('ubs'),
  (SELECT jsonb_agg(jsonb_build_object('dia', d, 'abre', '07:00', 'fecha', '19:00')) FROM generate_series(1, 5) d))$$,
  'A escala tem 1 plantões de hoje em diante fora deste horário', '2. a escala futura com noite impede o horário');
RESET ROLE;
DELETE FROM public.escala_plantao WHERE unidade_id = pg_temp.id('ubs');
SET LOCAL ROLE authenticated;
SELECT public.ubs_definir_funcionamento(pg_temp.id('ubs'),
  (SELECT jsonb_agg(jsonb_build_object('dia', d, 'abre', '07:00', 'fecha', '19:00')) FROM generate_series(1, 5) d));
SELECT pg_temp.ok(jsonb_array_length(public.ubs_funcionamento(pg_temp.id('ubs'))) = 5
                  AND public.ubs_funcionamento(pg_temp.id('ubs')) -> 0 ->> 'abre' = '07:00', '2. horário de segunda a sexta salvo');

-- ── 3. travas ───────────────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  '[{"dia": 1, "periodo": "noite", "inicio": "19:00", "fim": "22:00", "duracao": 20}]')$$,
  'Período da agenda fora do horário de funcionamento da UBS', '3. grade à noite recusada');
SELECT pg_temp.falha($$SELECT public.agenda_definir_configuracao(pg_temp.id('ubs'), pg_temp.id('med'),
  '[{"dia": 6, "periodo": "manha", "inicio": "07:00", "fim": "11:00", "duracao": 20}]')$$,
  'Período da agenda fora do horário de funcionamento da UBS', '3. grade no sábado recusada');
RESET ROLE;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('med'), pg_temp.segunda(), 'manha'),
       (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('med'), pg_temp.segunda(), 'tarde');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.escala_plantao WHERE unidade_id = pg_temp.id('ubs')), '3. manhã e tarde de segunda entram na escala');
SELECT pg_temp.falha($$INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
  VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('med'), pg_temp.segunda() + 1, 'noite')$$,
  'Plantão fora do horário de funcionamento da UBS', '3. noite recusada na escala da UBS');
SELECT pg_temp.falha($$INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
  VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('med'), pg_temp.segunda() + 5, 'manha')$$,
  'Plantão fora do horário de funcionamento da UBS', '3. sábado recusado na escala da UBS');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
VALUES (pg_temp.id('upa'), pg_temp.id('porta'), pg_temp.id('med'), pg_temp.segunda() + 1, 'noite');
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.escala_plantao WHERE unidade_id = pg_temp.id('upa')), '3. a UPA segue com a noite');

-- ── 4. vencimento pelo fechamento ───────────────────────────────────────────
-- UBS 2 fecha às 00:30 todos os dias (só para o teste); a ficha de hoje vence
-- depois das 01:30. Antes disso, no CI de madrugada, o passo é pulado.
INSERT INTO public.ubs_funcionamento (unidade_id, dia_semana, abre, fecha)
SELECT pg_temp.id('ubs2'), d, time '00:00', time '00:30' FROM generate_series(0, 6) d;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento) VALUES (pg_temp.id('pac'), pg_temp.id('ubs2'), 'Paciente do U3', date '1970-01-01');
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, tipo_atendimento_aps)
VALUES (pg_temp.id('ubs2'), pg_temp.id('pac'), pg_temp.id('cons2'), 'atendimento', 'Tosse', pg_temp.id('rec'),
        greatest(now() - interval '1 minute', date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'), 'consulta_no_dia');
DO $$
BEGIN
  IF (now() AT TIME ZONE 'America/Sao_Paulo')::time >= time '01:30' THEN
    PERFORM private.ubs_vencer_fichas();
    PERFORM pg_temp.ok((SELECT etapa = 'encerrado' AND desfecho = 'evasao' FROM public.episodios WHERE paciente_id = pg_temp.id('pac')),
      '4. a ficha de hoje vence uma hora depois do fechamento');
  ELSE
    RAISE NOTICE 'OK  4. (pulado: antes das 01:30)';
  END IF;
END $$;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ubs-ficha-vence' AND schedule = '*/30 * * * *'), '4. job a cada 30 minutos');

ROLLBACK;
