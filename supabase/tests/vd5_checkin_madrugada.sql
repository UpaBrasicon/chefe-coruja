-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000004_checkin_madrugada.sql (VD5 do lote "Virada
-- de data", BACKLOG.md). Tudo em transação com ROLLBACK.
--
-- Sem escala, o check-in entre 00h e 6h59 de Brasília fica na noite que
-- começou ontem, não na noite de hoje (que começa às 19h). A data do plantão
-- em curso sai de private.data_do_turno(instante), conferida aqui com horários
-- fixos, porque now() não se simula dentro da transação.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. a data do plantão em curso, nas viradas ──────────────────────────────
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
      ('2026-11-01 00:00:00-03'::timestamptz, '2026-10-31'::date, 'meia-noite: ainda a noite de ontem'),
      ('2026-11-01 03:30:00-03',              '2026-10-31',       'madrugada: noite de ontem'),
      ('2026-11-01 06:59:59-03',              '2026-10-31',       '6h59: noite de ontem'),
      ('2026-11-01 07:00:00-03',              '2026-11-01',       '7h: manhã de hoje'),
      ('2026-11-01 13:00:00-03',              '2026-11-01',       '13h: tarde de hoje'),
      ('2026-11-01 19:00:00-03',              '2026-11-01',       '19h: noite de hoje'),
      ('2026-11-01 23:59:59-03',              '2026-11-01',       '23h59: noite de hoje (UTC já é amanhã)'),
      ('2026-11-02 02:00:00+00',              '2026-11-01',       '23h em Brasília dado em UTC'),
      ('2027-01-01 02:00:00-03',              '2026-12-31',       'virada do ano: noite de 31/12'),
      ('2026-03-01 05:00:00-03',              '2026-02-28',       'virada de fevereiro: noite de 28/02')
    ) v(instante, esperado, caso)
  LOOP
    IF private.data_do_turno(c.instante) IS DISTINCT FROM c.esperado THEN
      RAISE EXCEPTION 'FALHOU: % (%): esperado %, veio %', c.caso, c.instante, c.esperado, private.data_do_turno(c.instante);
    END IF;
    RAISE NOTICE 'OK  %', c.caso;
  END LOOP;
END $$;

-- ── 2. o check-in sem escala usa essa data ──────────────────────────────────
DO $$
DECLARE
  s text;
BEGIN
  SELECT p.prosrc INTO s FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'registrar_checkin';
  IF s NOT LIKE '%coalesce(v_escala.data, private.data_do_turno())%' THEN
    RAISE EXCEPTION 'FALHOU: registrar_checkin sem escala deveria usar private.data_do_turno()';
  END IF;
  IF s LIKE '%coalesce(v_escala.data, private.data_atual())%' THEN
    RAISE EXCEPTION 'FALHOU: registrar_checkin ainda usa private.data_atual() sem escala';
  END IF;
  -- agora: a data do plantão em curso bate com a do turno de agora
  IF private.data_do_turno() <> (CASE WHEN private.turno_atual() = 'noite'
                                        AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < time '07:00'
                                      THEN private.data_atual() - 1 ELSE private.data_atual() END) THEN
    RAISE EXCEPTION 'FALHOU: data_do_turno() e turno_atual() discordam agora';
  END IF;
  RAISE NOTICE 'OK  check-in sem escala fica no plantão em curso';
END $$;

ROLLBACK;
