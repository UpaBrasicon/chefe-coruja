-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — check-out automático no fim do plantão (ADR 0003).
--
-- A presença aberta (check-in sem check-out) é fechada na hora em que a
-- janela do plantão termina — a hora do FIM do plantão, não a hora em que o
-- job rodou —, e marcada como automática para o gestor distinguir de um
-- check-out feito pela pessoa.
--
-- Presença sem plantão (acesso de atendimento) não tem janela e não é
-- fechada aqui.
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.presenca_plantonista
  ADD COLUMN IF NOT EXISTS checkout_automatico boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.fechar_presencas_vencidas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  UPDATE public.presenca_plantonista p
  SET checkout_em = e.inicio + make_interval(mins => e.duracao_min),
      checkout_automatico = true,
      updated_at = now()
  FROM public.escala_plantao e
  WHERE p.escala_plantao_id = e.id
    AND p.checkin_em IS NOT NULL
    AND p.checkout_em IS NULL
    AND now() >= e.inicio + make_interval(mins => e.duracao_min);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE EXECUTE ON FUNCTION private.fechar_presencas_vencidas() FROM PUBLIC, anon, authenticated;

-- A cada 5 minutos; roda como postgres.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'checkout-automatico';
SELECT cron.schedule('checkout-automatico', '*/5 * * * *', 'SELECT private.fechar_presencas_vencidas();');
