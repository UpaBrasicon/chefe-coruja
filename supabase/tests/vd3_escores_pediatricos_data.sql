-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000002_escores_pediatricos_data.sql (VD3 do lote
-- "Virada de data", BACKLOG.md; P0 clínico por decisão do RT em 01/11/2026).
-- Tudo em transação com ROLLBACK.
--
-- Os escores escolhem NEWS2 ou PEWS e a faixa de idade do PELOD-2/Phoenix
-- pelo dia da unidade (private.data_atual(), Brasília), não por current_date
-- (UTC no servidor: das 21h às 24h já é amanhã). O relógio da unidade é
-- fixado só nesta transação.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor uuid) ON COMMIT DROP;
INSERT INTO t SELECT 'pac', id FROM public.pacientes ORDER BY id LIMIT 1;
CREATE FUNCTION pg_temp.relogio(p date) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('CREATE OR REPLACE FUNCTION private.data_atual() RETURNS date LANGUAGE sql STABLE '
                 'SECURITY DEFINER SET search_path = '''' AS $f$ SELECT %L::date $f$', p);
END $$;
CREATE FUNCTION pg_temp.escala(p_nasc date) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.pacientes SET data_nascimento = p_nasc WHERE id = (SELECT valor FROM t WHERE nome = 'pac');
  RETURN private.calcular_acuidade((SELECT valor FROM t WHERE nome = 'pac')) ->> 'escala';
END $$;

-- ── 1. véspera e aniversário de 14 anos, no dia da unidade ──────────────────
DO $$
BEGIN
  PERFORM pg_temp.relogio('2026-12-30');
  IF pg_temp.escala('2012-12-31') IS DISTINCT FROM 'PEWS' THEN
    RAISE EXCEPTION 'FALHOU: véspera dos 14 anos deveria ser PEWS, veio %', pg_temp.escala('2012-12-31');
  END IF;
  RAISE NOTICE 'OK  véspera dos 14 anos: PEWS';
  IF pg_temp.escala('2012-12-30') IS DISTINCT FROM 'NEWS2' THEN
    RAISE EXCEPTION 'FALHOU: no aniversário de 14 anos deveria ser NEWS2, veio %', pg_temp.escala('2012-12-30');
  END IF;
  RAISE NOTICE 'OK  aniversário de 14 anos: NEWS2';
END $$;

-- ── 2. a escala segue o dia da unidade, não o relógio do servidor ───────────
DO $$
BEGIN
  -- no dia da unidade a pessoa tem 10 anos; pelo relógio do servidor, mais de 30
  PERFORM pg_temp.relogio('2000-06-15');
  IF pg_temp.escala('1990-01-01') IS DISTINCT FROM 'PEWS' THEN
    RAISE EXCEPTION 'FALHOU: a escala deveria seguir private.data_atual() (10 anos: PEWS), veio %', pg_temp.escala('1990-01-01');
  END IF;
  RAISE NOTICE 'OK  a escala segue o dia da unidade';
END $$;

-- ── 3. nenhum dos escores usa current_date ──────────────────────────────────
DO $$
DECLARE
  v_resto text;
BEGIN
  SELECT string_agg(n.nspname || '.' || p.proname, ', ') INTO v_resto
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE (n.nspname, p.proname) IN (('private', 'calcular_acuidade'), ('public', 'acuidade'),
                                    ('private', 'observacao_dispara_pelod2'), ('public', 'alertas_sepse'),
                                    ('private', 'pelod2_rotina'))
     AND p.prosrc ~* '\mcurrent_date\M';
  IF v_resto IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: ainda usam current_date (UTC): %', v_resto;
  END IF;
  RAISE NOTICE 'OK  escores pediátricos usam o dia da unidade';
END $$;

ROLLBACK;
