-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000052_turnos_avisos.sql (turnos da unidade nos
-- avisos, no turno em andamento, nos indicadores e no sobreaviso). Dados
-- próprios. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/escala_turnos_avisos.sql
--
--  * manhã, tarde e noite não mudam: o aviso de turno (a cada 30 s do dia, na
--    UPA e na UBS), o turno em andamento (a cada 10 min em 2 dias), o filtro
--    dos indicadores (a cada minuto), o acesso do plantão (plantoes_agora) e a
--    carga horária são comparados com as versões de antes, escritas aqui;
--  * turno cadastrado: os dois avisos com o nome do turno, nas horas certas
--    (também passando da meia-noite); turno_atual reconhece o plantão; o
--    filtro dos indicadores usa a janela do turno; a observação vencendo e o
--    aviso chegam ao plantonista do turno novo;
--  * sobreaviso: acesso sem check-in, não é check-in pendente (casca e
--    Hermes), sem aviso de passagem, "sobreaviso" na auditoria e horas à
--    parte na carga horária;
--  * barra: turno de outra unidade no filtro, gestor de outra unidade e
--    anônimo.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000f7b01'),
  ('uni',   '00000000-0000-4000-8000-0000000f7b0a'),
  ('uni2',  '00000000-0000-4000-8000-0000000f7b0b'),
  ('ubs',   '00000000-0000-4000-8000-0000000f7b0c'),
  ('ps',    '00000000-0000-4000-8000-0000000f7ba1'),
  ('ps2',   '00000000-0000-4000-8000-0000000f7ba2'),
  ('pac1',  '00000000-0000-4000-8000-0000000f7bc1'),
  ('pac2',  '00000000-0000-4000-8000-0000000f7bc2'),
  ('pac3',  '00000000-0000-4000-8000-0000000f7bc3'),
  ('gest',  '00000000-0000-4000-8000-0000000f7b11'),
  ('med',   '00000000-0000-4000-8000-0000000f7b12'),
  ('med2',  '00000000-0000-4000-8000-0000000f7b13'),
  ('enf',   '00000000-0000-4000-8000-0000000f7b14'),
  ('fora',  '00000000-0000-4000-8000-0000000f7b15');
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

-- As versões de antes (homologação, 24/11/2026), para comparar.
CREATE FUNCTION pg_temp.aviso_antigo(p_unidade uuid, p_hora time, p_turno text, OUT tipo text, OUT mensagem text)
RETURNS record LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF (SELECT u.tipo::text FROM public.unidades u WHERE u.id = p_unidade) = 'ubs' THEN
    RETURN;
  END IF;
  IF p_turno = 'noite' THEN
    IF p_hora >= time '19:30' AND p_hora < time '19:59' THEN
      tipo := 'noite_1930';
      mensagem := 'Você é o plantonista da noite. Confira os pacientes internados e em observação que estão sob sua responsabilidade.';
    ELSIF p_hora >= time '20:00' THEN
      tipo := 'noite_2000';
      mensagem := 'Plantão noturno em andamento. Verifique os pacientes internados e em observação da sua escala.';
    END IF;
  END IF;
  IF p_turno = 'manha' THEN
    IF p_hora >= time '07:30' AND p_hora < time '07:59' THEN
      tipo := 'manha_0730';
      mensagem := 'Bom dia! Assuma os pacientes internados e em observação do plantão da manhã.';
    ELSIF p_hora >= time '08:00' THEN
      tipo := 'manha_0800';
      mensagem := 'Plantão da manhã em andamento. Confira os pacientes internados e em observação.';
    END IF;
  END IF;
END $$;
CREATE FUNCTION pg_temp.turno_relogio(p_instante timestamptz) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN (p_instante AT TIME ZONE 'America/Sao_Paulo')::time >= time '07:00'
     AND (p_instante AT TIME ZONE 'America/Sao_Paulo')::time <  time '13:00' THEN 'manha'
    WHEN (p_instante AT TIME ZONE 'America/Sao_Paulo')::time >= time '13:00'
     AND (p_instante AT TIME ZONE 'America/Sao_Paulo')::time <  time '19:00' THEN 'tarde'
    ELSE 'noite'
  END
$$;
CREATE FUNCTION pg_temp.plantoes_agora_antigo() RETURNS SETOF public.escala_plantao LANGUAGE sql STABLE AS $$
  SELECT e.*
  FROM private.plantoes_na_janela() e
  WHERE (now() < e.inicio + private.tolerancia_checkin(e.unidade_id)
     OR EXISTS (
       SELECT 1 FROM public.presenca_plantonista x
        WHERE x.perfil_id = e.perfil_id AND x.unidade_id = e.unidade_id
          AND x.checkin_em IS NOT NULL
          AND (x.escala_plantao_id = e.id OR (x.data = e.data AND x.turno = e.turno)
               OR (x.checkin_em >= e.inicio AND x.checkin_em < e.inicio + make_interval(mins => e.duracao_min)))))
    AND private.checkout_do_plantao(e.id) IS NULL
  UNION
  SELECT e.*
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND now() >= e.inicio + make_interval(mins => e.duracao_min)
    AND (
      (now() < e.inicio + make_interval(mins => e.duracao_min) + private.tolerancia_fim_plantao()
       AND private.checkin_do_plantao(e.id) IS NOT NULL
       AND private.checkout_do_plantao(e.id) IS NULL)
      OR private.liberacao_pos_plantao_ativa(e.unidade_id)
    )
    AND now() < e.inicio + make_interval(mins => e.duracao_min) + interval '12 hours';
$$;
-- o mesmo conjunto de plantões liberados, antes e agora, para quem está no claim
CREATE FUNCTION pg_temp.agora_igual() RETURNS boolean LANGUAGE sql AS $$
  SELECT coalesce(array_agg(a.id ORDER BY a.id), '{}') IS NOT DISTINCT FROM
         (SELECT coalesce(array_agg(b.id ORDER BY b.id), '{}') FROM pg_temp.plantoes_agora_antigo() b)
    FROM private.plantoes_agora() a
$$;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@turnos-avisos.local' FROM ids WHERE nome IN ('gest', 'med', 'med2', 'enf', 'fora');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, nome FROM ids WHERE nome IN ('gest', 'med', 'med2', 'enf', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Org dos avisos');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('uni'),  pg_temp.id('org'), 'UPA dos avisos', 'hospital'),
  (pg_temp.id('uni2'), pg_temp.id('org'), 'UPA vizinha dos avisos', 'hospital'),
  (pg_temp.id('ubs'),  pg_temp.id('org'), 'UBS dos avisos', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('ps'),  pg_temp.id('uni'),  'Pronto Socorro', 'outro'),
  (pg_temp.id('ps2'), pg_temp.id('uni2'), 'Pronto Socorro vizinho', 'outro');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('uni'),  'gestor'),
  (pg_temp.id('med'),  pg_temp.id('uni'),  'plantonista'),
  (pg_temp.id('med2'), pg_temp.id('uni'),  'plantonista'),
  (pg_temp.id('enf'),  pg_temp.id('uni'),  'enfermeiro'),
  (pg_temp.id('fora'), pg_temp.id('uni2'), 'gestor');

-- ── 1. manhã, tarde e noite: igual a antes ──────────────────────────────────
SELECT pg_temp.ok(NOT EXISTS (
  SELECT 1 FROM generate_series(timestamp '2000-01-01 00:00', timestamp '2000-01-01 23:59:30', interval '30 seconds') s,
                unnest(ARRAY['manha', 'tarde', 'noite', 'madrugada', NULL]) tu,
                unnest(ARRAY[pg_temp.id('uni'), pg_temp.id('ubs')]) u
   WHERE (SELECT row(a.tipo, a.mensagem) FROM private.aviso_fixo_turno(u, s::time, tu) a)
         IS DISTINCT FROM (SELECT row(b.tipo, b.mensagem) FROM pg_temp.aviso_antigo(u, s::time, tu) b)),
  'aviso de turno de manhã, tarde e noite: igual ao de antes a cada 30 s do dia, na UPA e na UBS');

SELECT pg_temp.como('med');
SELECT pg_temp.ok(NOT EXISTS (
  SELECT 1 FROM generate_series(now() - interval '1 day', now() + interval '1 day', interval '10 minutes') s
   WHERE private.turno_da_unidade_em(pg_temp.id('uni'), s) IS DISTINCT FROM pg_temp.turno_relogio(s)),
  'turno em andamento da unidade com os três de sempre: o do relógio, a cada 10 min em 2 dias');
SELECT pg_temp.ok(private.turno_atual(pg_temp.id('uni')) = private.turno_atual()
                  AND public.turno_atual() = private.turno_atual(),
  'turno_atual com e sem unidade, sem turno cadastrado: o de antes');
SELECT pg_temp.ok(NOT EXISTS (
  SELECT 1 FROM generate_series(timestamp '2000-01-01 00:00', timestamp '2000-01-01 23:59', interval '1 minute') s,
                unnest(ARRAY['manha', 'tarde', 'noite']) tu
   WHERE private.hora_no_turno(pg_temp.id('uni'), tu, s::time)
         IS DISTINCT FROM (tu = CASE WHEN s::time >= time '07:00' AND s::time < time '13:00' THEN 'manha'
                                     WHEN s::time >= time '13:00' AND s::time < time '19:00' THEN 'tarde'
                                     ELSE 'noite' END)),
  'filtro de turno dos indicadores para manhã, tarde e noite: igual ao de antes a cada minuto');

-- plantão de sempre agora (med2) e plantões futuros (enf): acesso e carga como antes
INSERT INTO t VALUES ('dia_relogio', private.data_do_turno()::text), ('turno_relogio', private.turno_atual());
SELECT pg_temp.como('gest');
SET LOCAL ROLE authenticated;
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med2'),
  pg_temp.v('dia_relogio')::date, pg_temp.v('turno_relogio'));
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('enf'), private.data_atual() + 10, 'manha');
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('enf'), private.data_atual() + 11, 'noite');
RESET ROLE;
SELECT pg_temp.como('med2');
SELECT pg_temp.ok(pg_temp.agora_igual(), 'plantão de sempre em andamento: o acesso (plantoes_agora) é o de antes');
SELECT pg_temp.como('gest');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT EXISTS (
  (SELECT perfil_id, nome, diurnos, noturnos, horas, dias, categorias
     FROM public.resumo_carga_horaria(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31)
   EXCEPT
   SELECT * FROM public.resumo_carga_plantonistas(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31))
  UNION ALL
  (SELECT * FROM public.resumo_carga_plantonistas(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31)
   EXCEPT
   SELECT perfil_id, nome, diurnos, noturnos, horas, dias, categorias
     FROM public.resumo_carga_horaria(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31)))
  AND (SELECT count(*) FROM public.resumo_carga_horaria(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31)) = 2
  AND NOT EXISTS (SELECT 1 FROM public.resumo_carga_horaria(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31)
                   WHERE horas_sobreaviso <> 0 OR dias_sobreaviso <> 0),
  'carga horária sem sobreaviso: as colunas de resumo_carga_plantonistas, sobreaviso zerado');

-- ── 2. turnos cadastrados ───────────────────────────────────────────────────
-- Presencial e sobreaviso que começaram há 45 min (5 h); Diarista 08–17; Corujão 22–06
INSERT INTO t SELECT 'pres', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, 'Presencial agora',
  (date_trunc('minute', now() - interval '45 minutes') AT TIME ZONE 'America/Sao_Paulo')::time,
  (date_trunc('minute', now() + interval '255 minutes') AT TIME ZONE 'America/Sao_Paulo')::time)::text;
INSERT INTO t SELECT 'sobre', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, 'Sobreaviso agora',
  (date_trunc('minute', now() - interval '45 minutes') AT TIME ZONE 'America/Sao_Paulo')::time,
  (date_trunc('minute', now() + interval '255 minutes') AT TIME ZONE 'America/Sao_Paulo')::time, 'enfermagem', true)::text;
INSERT INTO t SELECT 'diar', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, 'Diarista', time '08:00', time '17:00')::text;
INSERT INTO t SELECT 'coru', public.salvar_turno_unidade(pg_temp.id('uni'), NULL, 'Corujão', time '22:00', time '06:00')::text;
RESET ROLE;
INSERT INTO t SELECT 'c_' || x.nome, tu.codigo FROM t x JOIN public.turnos_unidade tu ON tu.id = x.valor::uuid
 WHERE x.nome IN ('pres', 'sobre', 'diar', 'coru');
INSERT INTO t VALUES ('dia_agora', ((now() - interval '45 minutes') AT TIME ZONE 'America/Sao_Paulo')::date::text);

-- avisos do turno cadastrado: 30 min e 1 h depois do início, com o nome
SELECT pg_temp.ok(
  (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '08:29:59', pg_temp.v('c_diar')) a) IS NULL
  AND (SELECT a.tipo || '|' || a.mensagem FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '08:30', pg_temp.v('c_diar')) a)
      = pg_temp.v('c_diar') || '_0830|Você é o plantonista do turno Diarista. Confira os pacientes internados e em observação que estão sob sua responsabilidade.'
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '08:58:59', pg_temp.v('c_diar')) a) = pg_temp.v('c_diar') || '_0830'
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '08:59:30', pg_temp.v('c_diar')) a) IS NULL
  AND (SELECT a.tipo || '|' || a.mensagem FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '09:00', pg_temp.v('c_diar')) a)
      = pg_temp.v('c_diar') || '_0900|Plantão do turno Diarista em andamento. Confira os pacientes internados e em observação.'
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '16:59:59', pg_temp.v('c_diar')) a) = pg_temp.v('c_diar') || '_0900'
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '17:00', pg_temp.v('c_diar')) a) IS NULL
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '07:45', pg_temp.v('c_diar')) a) IS NULL,
  'turno cadastrado (Diarista 08–17): aviso às 08:30 e a partir das 09:00, com o nome, até o fim do turno');
SELECT pg_temp.ok(
  (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '22:30', pg_temp.v('c_coru')) a) = pg_temp.v('c_coru') || '_2230'
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '23:59:59', pg_temp.v('c_coru')) a) = pg_temp.v('c_coru') || '_2300'
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'), time '00:30', pg_temp.v('c_coru')) a) IS NULL,
  'turno que passa da meia-noite (Corujão 22–06): o aviso de andamento vai até a meia-noite, como a noite');
SELECT pg_temp.ok(
  (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni'),
     (date_trunc('minute', now() - interval '15 minutes') AT TIME ZONE 'America/Sao_Paulo')::time, pg_temp.v('c_sobre')) a) IS NULL
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('ubs'), time '08:30', pg_temp.v('c_diar')) a) IS NULL
  AND (SELECT a.tipo FROM private.aviso_fixo_turno(pg_temp.id('uni2'), time '08:30', pg_temp.v('c_diar')) a) IS NULL,
  'sem aviso no sobreaviso, na UBS e com código de outra unidade');

-- plantões de agora: med no presencial, enf no sobreaviso
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('gest');
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('med'), pg_temp.v('dia_agora')::date, pg_temp.v('c_pres'));
SELECT public.adicionar_plantao_escala(pg_temp.id('uni'), pg_temp.id('ps'), pg_temp.id('enf'), pg_temp.v('dia_agora')::date, pg_temp.v('c_sobre'));
RESET ROLE;

SELECT pg_temp.como('med');
SELECT pg_temp.ok(public.turno_atual() = pg_temp.v('c_pres') AND private.turno_atual(pg_temp.id('uni')) = pg_temp.v('c_pres'),
  'turno_atual reconhece o turno cadastrado do plantão em andamento');
SELECT pg_temp.ok(pg_temp.agora_igual(), 'plantão presencial no turno novo: o acesso continua pedindo check-in como antes');
SELECT pg_temp.como('med2');
SELECT pg_temp.ok(public.turno_atual() = private.turno_atual() AND private.turno_atual(pg_temp.id('uni')) = private.turno_atual(),
  'quem está num turno de sempre continua com o turno do relógio');

-- Hermes: lembra o presencial sem check-in, não o sobreaviso
SELECT pg_temp.ok((SELECT count(*) FROM public.hermes_checkin_pendente() h WHERE h.unidade_id = pg_temp.id('uni') AND h.perfil_id = pg_temp.id('med')) = 1
  AND (SELECT count(*) FROM public.hermes_checkin_pendente() h WHERE h.perfil_id = pg_temp.id('enf')) = 0,
  'lembrete de check-in do Hermes: o presencial sim, o sobreaviso não');

-- sobreaviso: liberado sem check-in, sem pendência
SELECT pg_temp.como('enf');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((public.situacao_checkin(pg_temp.id('uni')) ->> 'liberado')::boolean
                  AND NOT (public.situacao_checkin(pg_temp.id('uni')) ->> 'bloqueado')::boolean
                  AND public.situacao_checkin(pg_temp.id('uni')) -> 'pendente' = 'null'::jsonb,
  'sobreaviso: acesso liberado sem check-in, sem check-in pendente');
SELECT pg_temp.ok(private.turno_atual(pg_temp.id('uni')) = pg_temp.v('c_sobre'), 'turno_atual do sobreaviso é o turno dele');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.gerar_notificacoes_turno(pg_temp.id('uni')) n WHERE n.tipo LIKE pg_temp.v('c_sobre') || '%'),
  'sobreaviso não recebe aviso de passagem');
RESET ROLE;
SELECT pg_temp.ok(NOT pg_temp.agora_igual()
                  AND EXISTS (SELECT 1 FROM private.plantoes_agora() p WHERE p.turno = pg_temp.v('c_sobre')),
  'antes o sobreaviso ficava bloqueado sem check-in; agora vale a janela toda');

-- presencial: bloqueado sem check-in; com ele, recebe o aviso do turno novo
SELECT pg_temp.como('med');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((public.situacao_checkin(pg_temp.id('uni')) ->> 'bloqueado')::boolean
                  AND public.situacao_checkin(pg_temp.id('uni')) -> 'pendente' ->> 'turno' = pg_temp.v('c_pres'),
  'presencial no turno novo, 45 min sem check-in: bloqueado e com check-in pendente');
SELECT public.registrar_checkin(pg_temp.id('uni'));
SELECT pg_temp.ok((SELECT n.mensagem FROM public.gerar_notificacoes_turno(pg_temp.id('uni')) n
                    WHERE n.tipo LIKE pg_temp.v('c_pres') || '\_%')
                  = 'Você é o plantonista do turno Presencial agora. Confira os pacientes internados e em observação que estão sob sua responsabilidade.',
  'o plantonista do turno novo recebe o aviso de começo de turno com o nome dele');

-- auditoria do gestor e carga horária
SELECT pg_temp.como('gest');
SELECT pg_temp.ok((SELECT a.situacao || ' ' || a.divergente FROM public.auditoria_checkin(pg_temp.id('uni'), pg_temp.v('dia_agora')::date) a
                    WHERE a.perfil_id = pg_temp.id('enf')) = 'sobreaviso false',
  'auditoria de check-in: o sobreaviso aparece como sobreaviso, sem divergência');
SELECT pg_temp.ok((SELECT diurnos || ' ' || noturnos || ' ' || horas || ' ' || dias || ' ' || horas_sobreaviso || ' ' || dias_sobreaviso
                     FROM public.resumo_carga_horaria(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31)
                    WHERE perfil_id = pg_temp.id('enf')) = '1 1 18.0 2 5.0 1'
  AND (SELECT horas_sobreaviso || ' ' || dias_sobreaviso
         FROM public.resumo_carga_horaria(pg_temp.id('uni'), private.data_atual() - 1, private.data_atual() + 31)
        WHERE perfil_id = pg_temp.id('med')) = '0.0 0',
  'carga horária: 5 h de sobreaviso à parte; plantão de manhã e noite nas colunas de sempre');

-- ── 3. indicadores pelo turno da unidade ───────────────────────────────────
RESET ROLE;
-- um paciente por chegada (um episódio aberto por paciente)
INSERT INTO public.pacientes (id, unidade_id, nome)
SELECT pg_temp.id(p), pg_temp.id('uni'), 'Paciente dos avisos ' || p FROM unnest(ARRAY['pac1', 'pac2', 'pac3']) p;
INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, chegada_em)
SELECT pg_temp.id('uni'), pg_temp.id(x.p), pg_temp.id('ps'), 'teste ' || x.h, pg_temp.id('gest'),
       ((private.data_atual() - 2) + x.h) AT TIME ZONE 'America/Sao_Paulo'
  FROM (VALUES ('pac1', time '08:30'), ('pac2', time '14:30'), ('pac3', time '20:00')) x(p, h);
CREATE FUNCTION pg_temp.chegadas(p_turno text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(to_char(e.chegada_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), ',' ORDER BY e.chegada_em), '-')
    FROM public.episodios e
   WHERE e.id IN (SELECT private.episodios_filtrados(pg_temp.id('uni'), private.data_atual() - 2, private.data_atual() - 2, NULL, NULL, p_turno))
$$;
SELECT pg_temp.ok(pg_temp.chegadas(NULL) = '08:30,14:30,20:00' AND pg_temp.chegadas('manha') = '08:30'
                  AND pg_temp.chegadas('tarde') = '14:30' AND pg_temp.chegadas('noite') = '20:00',
  'indicadores: manhã, tarde e noite filtram a chegada como antes');
SELECT pg_temp.ok(pg_temp.chegadas(pg_temp.v('c_diar')) = '08:30,14:30' AND pg_temp.chegadas(pg_temp.v('c_coru')) = '-',
  'indicadores: o turno da unidade filtra pela janela dele (Diarista 08–17; Corujão 22–06)');
SELECT pg_temp.falha(format($q$SELECT private.episodios_filtrados(%L, current_date, current_date, NULL, NULL, 'tzzzzzzzzzz')$q$, pg_temp.id('uni')),
  'Turno inválido', 'indicadores: turno que não é da unidade é barrado');
SELECT pg_temp.falha(format($q$SELECT private.episodios_filtrados(%L, current_date, current_date, NULL, NULL, %L)$q$, pg_temp.id('uni2'), pg_temp.v('c_diar')),
  'Turno inválido', 'indicadores: turno de outra unidade é barrado');
SELECT pg_temp.como('gest');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((public.pacientes_por_cor(pg_temp.id('uni'), private.data_atual() - 2, private.data_atual() - 2, NULL, NULL, pg_temp.v('c_diar')) ->> 'total')::int = 2
  AND (public.pacientes_por_cor(pg_temp.id('uni'), private.data_atual() - 2, private.data_atual() - 2, NULL, NULL, 'noite') ->> 'total')::int = 1,
  'pacientes por cor com o turno da unidade');

-- ── 4. outra unidade e anônimo ─────────────────────────────────────────────
SELECT pg_temp.como('fora');
SELECT pg_temp.falha(format($q$SELECT * FROM public.resumo_carga_horaria(%L, current_date, current_date + 30)$q$, pg_temp.id('uni')),
  'Acesso negado', 'o gestor de outra unidade não lê a carga horária');
SELECT pg_temp.falha(format($q$SELECT public.pacientes_por_cor(%L, current_date, current_date, NULL, NULL, %L)$q$, pg_temp.id('uni'), pg_temp.v('c_diar')),
  'Acesso negado', 'o gestor de outra unidade não lê os indicadores');
SET LOCAL ROLE anon;
SELECT pg_temp.falha(format($q$SELECT * FROM public.resumo_carga_horaria(%L, current_date, current_date + 30)$q$, pg_temp.id('uni')),
  'permission denied', 'anônimo não chama a carga horária');
RESET ROLE;

SELECT count(*) AS testes FROM resultado;
ROLLBACK;
