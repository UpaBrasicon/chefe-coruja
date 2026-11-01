-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000005_quinzenal_continuo.sql (VD6 do lote
-- "Virada de data", BACKLOG.md). Tudo em transação com ROLLBACK.
--
-- O fixo quinzenal (15/15) alterna semana sim, semana não, também na virada de
-- mês e de ano. Antes, quem caía nos dias 29–31 caía de novo nos dias 1–7 do
-- mês seguinte (duas semanas seguidas). Meses de 2031 e 2032, longe do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

-- só as fixas do teste: as do seed ficam de fora
UPDATE public.escala_fixa SET ativo = false WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
-- quarta (29/10/2031 cai na semana dos dias 29–31) e segunda (29/12/2031, virada do ano)
INSERT INTO public.escala_fixa (unidade_id, setor_id, perfil_id, dia_semana, turno, quinzenal, ativo) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   3, 'tarde', true, true),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   1, 'tarde', true, true);

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.gerar_escala_mensal_detalhada('21000000-0000-4000-8000-000000000001', 2031, m) FROM generate_series(10, 12) m;
SELECT public.gerar_escala_mensal_detalhada('21000000-0000-4000-8000-000000000001', 2032, 1);
RESET ROLE;

-- ── 1. semana sim, semana não, de outubro/2031 a janeiro/2032 ───────────────
DO $$
DECLARE
  c record;
  n int;
BEGIN
  FOR c IN SELECT dow, caso FROM (VALUES (3, 'quarta, virada de outubro'), (1, 'segunda, virada do ano')) v(dow, caso) LOOP
    SELECT count(*) INTO n FROM public.escala_plantao
     WHERE setor_id = '22000000-0000-4000-8000-000000000002' AND perfil_id = '10000000-0000-4000-8000-000000000002'
       AND turno = 'tarde' AND quinzenal AND data BETWEEN date '2031-10-01' AND date '2032-01-31'
       AND EXTRACT(ISODOW FROM data)::int % 7 = c.dow;
    IF n < 8 THEN
      RAISE EXCEPTION 'FALHOU: % — só % plantões em quatro meses', c.caso, n;
    END IF;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT data - lag(data) OVER (ORDER BY data) AS intervalo
          FROM public.escala_plantao
         WHERE setor_id = '22000000-0000-4000-8000-000000000002' AND perfil_id = '10000000-0000-4000-8000-000000000002'
           AND turno = 'tarde' AND quinzenal AND data BETWEEN date '2031-10-01' AND date '2032-01-31'
           AND EXTRACT(ISODOW FROM data)::int % 7 = c.dow) x
       WHERE intervalo <> 14) THEN
      RAISE EXCEPTION 'FALHOU: % — plantões sem 14 dias entre si: %', c.caso,
        (SELECT string_agg(to_char(data, 'DD/MM/YYYY'), ', ' ORDER BY data) FROM public.escala_plantao
          WHERE setor_id = '22000000-0000-4000-8000-000000000002' AND perfil_id = '10000000-0000-4000-8000-000000000002'
            AND turno = 'tarde' AND quinzenal AND data BETWEEN date '2031-10-01' AND date '2032-01-31'
            AND EXTRACT(ISODOW FROM data)::int % 7 = c.dow);
    END IF;
    RAISE NOTICE 'OK  % (% plantões, 14 em 14 dias)', c.caso, n;
  END LOOP;
END $$;

-- ── 2. a semana do quinzenal: de segunda a domingo, alternada sem quebra ────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM generate_series(date '2026-01-01', date '2032-12-31', interval '1 day') g(d)
              WHERE private.semana_quinzenal(d::date) = private.semana_quinzenal(d::date + 7)) THEN
    RAISE EXCEPTION 'FALHOU: dia e mesmo dia da semana seguinte na mesma paridade';
  END IF;
  IF EXISTS (SELECT 1 FROM generate_series(date '2026-01-01', date '2032-12-31', interval '1 day') g(d)
              WHERE EXTRACT(ISODOW FROM d) <> 1
                AND private.semana_quinzenal(d::date) <> private.semana_quinzenal(d::date - 1)) THEN
    RAISE EXCEPTION 'FALHOU: a semana do quinzenal deveria virar só na segunda-feira';
  END IF;
  IF NOT private.semana_quinzenal(date '2000-01-03') OR private.semana_quinzenal(date '2000-01-10') THEN
    RAISE EXCEPTION 'FALHOU: âncora 03/01/2000 deveria ser semana de trabalho e a seguinte, não';
  END IF;
  RAISE NOTICE 'OK  semana do quinzenal alterna toda segunda-feira, sem quebra de mês ou ano';
END $$;

-- ── 3. ninguém executa o helper direto ──────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'private.semana_quinzenal(date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated não deveria executar private.semana_quinzenal';
  END IF;
  RAISE NOTICE 'OK  helper sem acesso direto';
END $$;

ROLLBACK;
