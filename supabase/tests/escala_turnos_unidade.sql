-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000050_turnos_unidade.sql (turnos configuráveis
-- por unidade, pedido do RT de 24/11/2026). Dados próprios. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_turnos_unidade.sql
--
--  * os três turnos de sempre: semeados em toda unidade (também na nova), com
--    o mesmo código e horário; inicio_do_turno e duracao_padrao devolvem o
--    mesmo de antes (fórmula antiga escrita aqui) em 60 dias; a janela gravada
--    na escala e as faixas da grade continuam iguais;
--  * o gestor cadastra Diurno 07–19 e Diarista 08–17; a fixa, a escala e a
--    grade usam o turno novo; o check-in vale para ele (janela);
--  * barra: quem não é gestor, escrita direta, horário dos três de sempre,
--    horário de turno com plantão pela frente, código de outra unidade,
--    turno desativado, desativar turno da fixa; outra unidade não lê.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000f7001'),
  ('uni',   '00000000-0000-4000-8000-0000000f700a'),
  ('uni2',  '00000000-0000-4000-8000-0000000f700b'),
  ('ps',    '00000000-0000-4000-8000-0000000f70a1'),
  ('ps2',   '00000000-0000-4000-8000-0000000f70a2'),
  ('gest',  '00000000-0000-4000-8000-0000000f7011'),
  ('med',   '00000000-0000-4000-8000-0000000f7012'),
  ('enf',   '00000000-0000-4000-8000-0000000f7013'),
  ('fora',  '00000000-0000-4000-8000-0000000f7014');
GRANT SELECT ON ids TO authenticated, anon;
CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE TEMP TABLE resultado (n serial, msg text) ON COMMIT DROP;
GRANT ALL ON resultado TO authenticated, anon;
GRANT USAGE ON SEQUENCE resultado_n_seq TO authenticated, anon;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.como(quem text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(quem), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(quem)::text, true);
END $$;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok); RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok; INSERT INTO resultado (msg) VALUES (p_ok);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text), pg_temp.v(text), pg_temp.como(text), pg_temp.falha(text, text, text),
  pg_temp.ok(boolean, text) TO authenticated, anon;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@turnos-unidade.local' FROM ids WHERE nome IN ('gest', 'med', 'enf', 'fora');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'enf', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org dos turnos');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni'),  pg_temp.id('org'), 'UPA dos turnos', 'hospital'),
  (pg_temp.id('uni2'), pg_temp.id('org'), 'UPA vizinha', 'hospital');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('ps'),  pg_temp.id('uni'),  'Pronto Socorro', 'outro'),
  (pg_temp.id('ps2'), pg_temp.id('uni2'), 'Pronto Socorro vizinho', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'),  'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'),  'plantonista'),
  (pg_temp.id('enf'),  pg_temp.id('uni'),  'enfermeiro'),
  (pg_temp.id('fora'), pg_temp.id('uni2'), 'gestor');

-- ── 1. os três turnos de sempre continuam iguais ────────────────────────────
SELECT pg_temp.ok((SELECT string_agg(codigo || ' ' || nome || ' ' || to_char(inicio, 'HH24:MI') || '-' || to_char(fim, 'HH24:MI')
                                     || ' ' || duracao_min || ' ' || padrao || ' ' || ativo, ', ' ORDER BY ordem)
                     FROM public.turnos_unidade WHERE unidade_id = pg_temp.id('uni'))
  = 'manha Manhã 07:00-13:00 360 true true, tarde Tarde 13:00-19:00 360 true true, noite Noite 19:00-07:00 720 true true',
  'a unidade nova nasce com manhã, tarde e noite de sempre');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.unidades u
                               WHERE (SELECT count(*) FROM public.turnos_unidade x WHERE x.unidade_id = u.id AND x.padrao) <> 3),
  'toda unidade tem os três turnos de sempre');
-- a fórmula de antes (20260926000003), escrita aqui, contra a função de agora
SELECT pg_temp.ok(NOT EXISTS (
  SELECT 1 FROM generate_series(private.data_atual() - 30, private.data_atual() + 30, interval '1 day') d,
                unnest(ARRAY['manha', 'tarde', 'noite', 'madrugada']) tu
   WHERE private.inicio_do_turno(d::date, tu) IS DISTINCT FROM
           ((d::date + CASE tu WHEN 'manha' THEN time '07:00' WHEN 'tarde' THEN time '13:00'
                               WHEN 'noite' THEN time '19:00' WHEN 'madrugada' THEN time '01:00' END) AT TIME ZONE 'America/Sao_Paulo')
      OR private.duracao_padrao(tu) IS DISTINCT FROM (CASE tu WHEN 'noite' THEN 720 ELSE 360 END)),
  'inicio_do_turno e duracao_padrao dos turnos de sempre: iguais aos de antes em 60 dias');
SELECT pg_temp.ok(private.nome_do_turno('manha') = 'manhã' AND private.nome_do_turno('tarde') = 'tarde'
                  AND private.nome_do_turno('noite') = 'noite' AND private.nome_do_turno('madrugada') = 'noite'
                  AND private.turno_no_texto('manha') = 'manha',
  'o nome dos turnos de sempre nas mensagens não muda');

INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno) VALUES
  (pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('enf'), private.data_atual() + 10, 'manha'),
  (pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('enf'), private.data_atual() + 11, 'noite');
SELECT pg_temp.ok((SELECT string_agg(turno || ' ' || to_char(inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' ' || duracao_min, ', ' ORDER BY data)
                     FROM public.escala_plantao WHERE perfil_id = pg_temp.id('enf'))
  = 'manha 07:00 360, noite 19:00 720',
  'a janela gravada na escala para manhã e noite é a de antes');
SELECT pg_temp.ok((SELECT string_agg(turno || ':' || jsonb_array_length(escalados), ',' ORDER BY turno)
                     FROM private.escala_faixas(pg_temp.id('uni'), private.data_atual() + 10, private.data_atual() + 10))
  = 'manha:1,noite:0,tarde:0',
  'a grade de um dia tem as três faixas de sempre, com quem está nelas');

-- ── 2. o gestor cadastra turnos novos ───────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
INSERT INTO t SELECT 'diurno', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, '  Diurno ', time '07:00', time '19:00')::text;
INSERT INTO t SELECT 'diarista', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, 'Diarista', time '08:00', time '17:00', 'medico')::text;
INSERT INTO t SELECT 'sobre', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, 'Sobreaviso enfermagem', time '19:00', time '07:00', 'enfermagem', true)::text;
INSERT INTO t SELECT 'cod_diurno', codigo FROM public.turnos_unidade WHERE id = pg_temp.v('diurno')::uuid;
INSERT INTO t SELECT 'cod_diarista', codigo FROM public.turnos_unidade WHERE id = pg_temp.v('diarista')::uuid;
INSERT INTO t SELECT 'cod_sobre', codigo FROM public.turnos_unidade WHERE id = pg_temp.v('sobre')::uuid;
SELECT pg_temp.ok((SELECT string_agg(nome || ' ' || duracao_min || ' ' || cobre || ' ' || sobreaviso || ' ' || (codigo ~ '^t[0-9a-f]{10}$'), ', ' ORDER BY ordem)
                     FROM public.turnos_unidade WHERE unidade_id = pg_temp.id('uni') AND NOT padrao)
  = 'Diurno 720 todos false true, Diarista 540 medico false true, Sobreaviso enfermagem 720 enfermagem true true',
  'o gestor cadastra Diurno 12 h, Diarista 9 h e sobreaviso; código novo próprio');
SELECT pg_temp.falha(format($q$SELECT public.salvar_turno_unidade(%L, NULL, 'diurno', '08:00', '20:00')$q$, pg_temp.id('uni')),
  'Já existe um turno ativo com esse nome', 'nome repetido na unidade é barrado');
SELECT pg_temp.falha(format($q$SELECT public.salvar_turno_unidade(%L, NULL, 'Curto', '08:00', '08:30')$q$, pg_temp.id('uni')),
  'O turno precisa ter pelo menos 1 hora', 'turno de menos de 1 hora é barrado');
SELECT pg_temp.falha(format($q$SELECT public.salvar_turno_unidade(%L, %L, 'Manhã', '06:00', '12:00')$q$,
                            pg_temp.id('uni'), (SELECT id FROM public.turnos_unidade WHERE unidade_id = pg_temp.id('uni') AND codigo = 'manha')),
  'O horário da manhã, da tarde e da noite não muda', 'o horário da manhã não se edita');
SELECT public.salvar_turno_unidade(pg_temp.id('uni'), (SELECT id FROM public.turnos_unidade WHERE unidade_id = pg_temp.id('uni') AND codigo = 'manha'),
                                   'Manhã curta', '07:00', '13:00');
SELECT pg_temp.ok((SELECT nome FROM public.turnos_unidade WHERE unidade_id = pg_temp.id('uni') AND codigo = 'manha') = 'Manhã curta',
  'o nome da manhã pode mudar (o horário não)');
SELECT pg_temp.falha($$INSERT INTO public.turnos_unidade (unidade_id, codigo, nome, inicio, fim, duracao_min)
                       VALUES ('00000000-0000-4000-8000-0000000f700a', 't0000000000', 'x', '08:00', '09:00', 60)$$,
  'permission denied', 'não se grava direto na tabela');

-- a fixa e a escala usam o turno novo; a janela vem do cadastro
INSERT INTO public.escala_fixa (unidade_id, setor_id, perfil_id, dia_semana, turno)
VALUES (pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med'), 1, pg_temp.v('cod_diurno'));
SELECT pg_temp.ok((SELECT count(*) FROM public.escala_fixa WHERE turno = pg_temp.v('cod_diurno')) = 1,
  'o gestor põe o turno novo na escala fixa');
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med'), private.data_atual() + 12, pg_temp.v('cod_diurno'));
SELECT pg_temp.ok((SELECT to_char(inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' ' || duracao_min
                     FROM public.escala_plantao WHERE perfil_id = pg_temp.id('med') AND data = private.data_atual() + 12)
  = '07:00 720', 'o plantão do Diurno grava a janela 07–19');
SELECT pg_temp.ok((SELECT string_agg(f.turno || ':' || jsonb_array_length(f.escalados), ',' ORDER BY tu.ordem)
                     FROM private.escala_faixas(pg_temp.id('uni'), private.data_atual() + 12, private.data_atual() + 12) f
                     JOIN public.turnos_unidade tu ON tu.unidade_id = pg_temp.id('uni') AND tu.codigo = f.turno)
  = 'manha:1,tarde:1,noite:0,' || pg_temp.v('cod_diurno') || ':1,' || pg_temp.v('cod_diarista') || ':1,' || pg_temp.v('cod_sobre') || ':0',
  'a grade mostra os turnos da unidade; o Diurno aparece nas faixas que cobre');
SELECT pg_temp.ok((SELECT diurnos || ' ' || noturnos || ' ' || horas FROM public.resumo_carga_plantonistas(pg_temp.id('uni'), private.data_atual(), private.data_atual() + 31)
                    WHERE perfil_id = pg_temp.id('med')) = '1 0 12.0',
  'a carga horária conta o Diurno como diurno de 12 h');
RESET ROLE;   -- descrever_plantao é interna (sem grant a authenticated)
SELECT pg_temp.ok(private.descrever_plantao((SELECT id FROM public.escala_plantao WHERE perfil_id = pg_temp.id('med') AND data = private.data_atual() + 12))
  LIKE 'Pronto Socorro em % (Diurno)', 'o aviso de passagem e troca diz o nome do turno novo');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(public.marcar_vaga_escala(pg_temp.id('ps'), private.data_atual() + 13, pg_temp.v('cod_diarista')) IS NOT NULL,
  'o gestor marca vaga no turno novo');

-- o horário do turno com plantão pela frente não muda
SELECT pg_temp.falha(format($q$SELECT public.salvar_turno_unidade(%L, %L, 'Diurno', '08:00', '20:00')$q$, pg_temp.id('uni'), pg_temp.v('diurno')),
  'Este turno já tem plantões marcados', 'horário de turno com plantão pela frente não muda');
-- desativar: não com gente na fixa; desativado sai da fixa e da vaga
SELECT pg_temp.falha(format($q$SELECT public.ativar_turno_unidade(%L, false)$q$, pg_temp.v('diurno')),
  'Este turno está na escala fixa', 'turno da escala fixa não desativa');
SELECT public.ativar_turno_unidade(pg_temp.v('sobre')::uuid, false);
SELECT pg_temp.falha(format($q$INSERT INTO public.escala_fixa (unidade_id, setor_id, perfil_id, dia_semana, turno) VALUES (%L, %L, %L, 2, %L)$q$,
                            pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('enf'), pg_temp.v('cod_sobre')),
  'Turno inválido', 'turno desativado não entra na fixa');
SELECT pg_temp.falha(format($q$SELECT public.marcar_vaga_escala(%L, private.data_atual() + 13, %L)$q$, pg_temp.id('ps'), pg_temp.v('cod_sobre')),
  'Faixa inválida', 'turno desativado não recebe vaga');
SELECT pg_temp.ok((SELECT count(*) FROM private.escala_faixas(pg_temp.id('uni'), private.data_atual() + 13, private.data_atual() + 13)
                    WHERE turno = pg_temp.v('cod_sobre')) = 0, 'turno desativado sai da grade');

-- ── 3. o médico: candidatura e check-in no turno novo ──────────────────────
SELECT pg_temp.como('med');
SELECT pg_temp.ok(public.candidatar_faixa(pg_temp.id('ps'), private.data_atual() + 14, pg_temp.v('cod_diarista')) IS NOT NULL,
  'o médico se candidata ao turno novo que o médico cobre');
SELECT pg_temp.falha(format($q$SELECT public.salvar_turno_unidade(%L, NULL, 'Meu turno', '08:00', '12:00')$q$, pg_temp.id('uni')),
  'Acesso negado', 'o médico não cadastra turno');
SELECT pg_temp.ok((SELECT count(*) FROM public.turnos_unidade WHERE unidade_id = pg_temp.id('uni')) = 6,
  'a equipe da unidade lê os turnos dela');

-- turno que começou há 10 minutos: o check-in vale pela janela, como nos de sempre
SELECT pg_temp.como('gest');
INSERT INTO t SELECT 'agora', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, 'Turno de agora',
  (date_trunc('minute', now() - interval '10 minutes') AT TIME ZONE 'America/Sao_Paulo')::time,
  (date_trunc('minute', now() + interval '5 hours') AT TIME ZONE 'America/Sao_Paulo')::time)::text;
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med'),
  ((now() - interval '10 minutes') AT TIME ZONE 'America/Sao_Paulo')::date,
  (SELECT codigo FROM public.turnos_unidade WHERE id = pg_temp.v('agora')::uuid));
SELECT pg_temp.como('med');
SELECT pg_temp.ok((SELECT count(*) FROM public.meu_plantao_agora()
                    WHERE turno = (SELECT codigo FROM public.turnos_unidade WHERE id = pg_temp.v('agora')::uuid)) = 1,
  'o turno novo em andamento é o plantão de agora');
SELECT public.registrar_checkin(pg_temp.id('uni'));
SELECT pg_temp.ok((SELECT turno FROM public.presenca_plantonista WHERE perfil_id = pg_temp.id('med') AND checkin_em IS NOT NULL)
  = (SELECT codigo FROM public.turnos_unidade WHERE id = pg_temp.v('agora')::uuid),
  'o check-in no turno novo grava a presença com o código dele');

-- ── 4. outra unidade ────────────────────────────────────────────────────────
SELECT pg_temp.como('fora');
SELECT pg_temp.ok((SELECT count(*) FROM public.turnos_unidade WHERE unidade_id = pg_temp.id('uni')) = 0,
  'o gestor de outra unidade não lê os turnos desta');
SELECT pg_temp.falha(format($q$SELECT public.salvar_turno_unidade(%L, NULL, 'Invasor', '08:00', '12:00')$q$, pg_temp.id('uni')),
  'Acesso negado', 'o gestor de outra unidade não cadastra turno aqui');
SELECT pg_temp.falha(format($q$SELECT public.ativar_turno_unidade(%L, false)$q$, pg_temp.v('diarista')),
  'Acesso negado', 'o gestor de outra unidade não desativa turno daqui');
SELECT pg_temp.falha(format($q$SELECT public.adicionar_plantao_escala(%L, %L, %L, private.data_atual() + 15, %L)$q$,
                            pg_temp.id('uni2'), pg_temp.id('ps2'), pg_temp.id('fora'), pg_temp.v('cod_diurno')),
  'Turno inválido', 'código de turno de outra unidade é barrado');

SET LOCAL ROLE anon;
SELECT pg_temp.falha(format($q$SELECT public.salvar_turno_unidade(%L, NULL, 'x', '08:00', '12:00')$q$, pg_temp.id('uni')),
  'permission denied', 'anônimo não chama');
RESET ROLE;

SELECT count(*) AS testes FROM resultado;
ROLLBACK;
