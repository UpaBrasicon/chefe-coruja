-- Testes da migration 20260926000008_fase1_checkin_raio.sql
-- Banco local com o seed (Unidade Teste em -16.6869, -49.2648, raio 500 m;
-- o plantonista do seed está escalado na Clínica Médica agora).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

DO $$ BEGIN
  PERFORM public.registrar_checkin('21000000-0000-4000-8000-000000000001', -16.70, -49.30);
  RAISE EXCEPTION 'FALHOU: check-in a ~4 km foi aceito sem justificativa';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'CHECKIN_FORA_DO_RAIO:%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  fora do raio é recusado (%)', SQLERRM;
END $$;

DO $$ BEGIN
  PERFORM public.registrar_checkin('21000000-0000-4000-8000-000000000001', NULL, NULL);
  RAISE EXCEPTION 'FALHOU: check-in sem localização foi aceito sem justificativa';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'CHECKIN_SEM_LOCALIZACAO:%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  sem localização é recusado';
END $$;

DO $$ BEGIN
  PERFORM public.registrar_checkin('21000000-0000-4000-8000-000000000001', -16.70, -49.30, NULL, 'gps');
  RAISE EXCEPTION 'FALHOU: justificativa de 3 letras foi aceita';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'CHECKIN_JUSTIFICATIVA_CURTA:%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  justificativa curta é recusada';
END $$;

DO $$
DECLARE v uuid; r public.presenca_plantonista%ROWTYPE;
BEGIN
  v := public.registrar_checkin('21000000-0000-4000-8000-000000000001', -16.70, -49.30, NULL, 'GPS do celular marcando outro bairro');
  SELECT * INTO r FROM public.presenca_plantonista WHERE id = v;
  IF r.checkin_dentro IS NOT FALSE OR r.checkin_justificativa IS NULL OR r.checkin_distancia_m < 1000 THEN
    RAISE EXCEPTION 'FALHOU: check-in justificado deveria ficar como fora do raio, com justificativa e distância';
  END IF;
  RAISE NOTICE 'OK  com justificativa passa, registrado fora do raio a % m', r.checkin_distancia_m;

  v := public.registrar_checkin('21000000-0000-4000-8000-000000000001', -16.6870, -49.2649);
  SELECT * INTO r FROM public.presenca_plantonista WHERE id = v;
  IF r.checkin_dentro IS NOT TRUE OR r.checkin_justificativa IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: check-in dentro do raio deveria passar limpo';
  END IF;
  RAISE NOTICE 'OK  dentro do raio passa sem justificativa (% m)', r.checkin_distancia_m;
END $$;

RESET ROLE;
ROLLBACK;
