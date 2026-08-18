-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 3 ADT — Censo agendado de madrugada (pg_cron)
-- Agenda a materialização do censo para 03:00, processando o dia ANTERIOR
-- (dia completo), para não pesar o sistema durante o atendimento diurno.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Gera o censo de TODAS as unidades ativas para uma data (dia anterior)
CREATE OR REPLACE FUNCTION public.gerar_censo_todas_unidades(p_data date DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  v_unidade record;
  v_total integer := 0;
  v_data date := coalesce(p_data, current_date - 1);
BEGIN
  FOR v_unidade IN SELECT id FROM public.unidades WHERE ativo LOOP
    PERFORM public.gerar_censo_diario(v_unidade.id, v_data);
    v_total := v_total + 1;
  END LOOP;
  RETURN v_total;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Agenda: diariamente às 03:00 (horário do servidor, UTC-3 = 06:00 UTC)
-- Cron expr padrão é em UTC no pg_cron. 03:00 BRT = 06:00 UTC.
SELECT cron.unschedule('censo-diario-madrugada') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'censo-diario-madrugada'
);

SELECT cron.schedule(
  'censo-diario-madrugada',          -- nome do job
  '0 6 * * *',                       -- diário 06:00 UTC = 03:00 America/Sao_Paulo
  $$ SELECT public.gerar_censo_todas_unidades(); $$
);
