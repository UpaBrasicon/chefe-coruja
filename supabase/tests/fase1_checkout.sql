-- Testes da migration 20260926000007_fase1_checkout_automatico.sql
-- Banco local, transação com ROLLBACK. Usa a unidade/setor/plantonista do seed.
BEGIN;

ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (id, unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  -- terminou há 10 min
  ('30000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', '2001-01-01', 'manha', now() - interval '370 minutes', 360),
  -- ainda em curso
  ('30000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', '2001-01-01', 'tarde', now() - interval '60 minutes', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em) VALUES
  ('21000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2001-01-01', 'manha', now() - interval '6 hours'),
  ('21000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '2001-01-01', 'tarde', now() - interval '50 minutes');

DO $$
DECLARE n integer; a public.presenca_plantonista%ROWTYPE; b public.presenca_plantonista%ROWTYPE;
BEGIN
  n := private.fechar_presencas_vencidas();
  SELECT * INTO a FROM public.presenca_plantonista WHERE escala_plantao_id = '30000000-0000-4000-8000-000000000001';
  SELECT * INTO b FROM public.presenca_plantonista WHERE escala_plantao_id = '30000000-0000-4000-8000-000000000002';
  IF n <> 1 OR a.checkout_em IS NULL OR NOT a.checkout_automatico THEN
    RAISE EXCEPTION 'FALHOU: presença vencida não foi fechada (n=%)', n;
  END IF;
  IF a.checkout_em > now() - interval '9 minutes' THEN
    RAISE EXCEPTION 'FALHOU: check-out deveria ser a hora do FIM do plantão, veio %', a.checkout_em;
  END IF;
  IF b.checkout_em IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: plantão em curso foi fechado';
  END IF;
  RAISE NOTICE 'OK  vencida fechada na hora do fim do plantão; em curso intacta';
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'checkout-automatico' AND schedule = '*/5 * * * *') THEN
    RAISE NOTICE 'OK  job agendado a cada 5 minutos';
  ELSE
    RAISE EXCEPTION 'FALHOU: job checkout-automatico não agendado';
  END IF;
END $$;

ROLLBACK;
