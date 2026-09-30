-- Testes da migration 20260927000008_hermes_vigias.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/hermes_vigias.sql
BEGIN;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004');
-- presenças de check-ins reais no banco local (desde 20261014000001 a tela cobra o check-in) não entram no teste
DELETE FROM public.presenca_plantonista WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  -- começou há 30 min, sem check-in → pendente
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '30 minutes', 360),
  -- começou há 30 min, com check-in → não
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '30 minutes', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, perfil_id, data, turno, checkin_em)
VALUES ('21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', private.data_atual(), 'manha', now() - interval '25 minutes');

-- 90 aberturas de prontuário numa hora por uma pessoa
ALTER TABLE public.log_acesso_prontuario DISABLE TRIGGER trg_acesso_so_insercao;
INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, tipo_acesso)
SELECT '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000001', 'leitura_prontuario'
FROM generate_series(1, 90);
ALTER TABLE public.log_acesso_prontuario ENABLE TRIGGER trg_acesso_so_insercao;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hermes_checkin_pendente() WHERE perfil_id = '10000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'FALHOU: plantão sem check-in há 30 min não apareceu';
  END IF;
  IF EXISTS (SELECT 1 FROM public.hermes_checkin_pendente() WHERE perfil_id = '10000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'FALHOU: quem fez check-in foi cobrado';
  END IF;
  RAISE NOTICE 'OK  check-in pendente: só quem não fez';
  IF NOT EXISTS (SELECT 1 FROM public.hermes_acessos_anomalos() WHERE perfil_id = '10000000-0000-4000-8000-000000000001' AND aberturas >= 90) THEN
    RAISE EXCEPTION 'FALHOU: 90 aberturas não viraram anomalia';
  END IF;
  RAISE NOTICE 'OK  aberturas de prontuário fora do padrão são detectadas';
  IF EXISTS (SELECT 1 FROM public.hermes_buracos_escala(3) WHERE setor = 'Clínica Médica' AND unidade_id = '21000000-0000-4000-8000-000000000001'
             AND horas_sem_ninguem > 0) THEN
    RAISE EXCEPTION 'FALHOU: setor coberto nas próximas 3 h apareceu como buraco';
  END IF;
  RAISE NOTICE 'OK  setor coberto não é buraco';
  IF public.hermes_cadeia_auditoria() IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: cadeia acusada sem adulteração'; END IF;
  RAISE NOTICE 'OK  cadeia íntegra devolve NULL';
END $$;
ROLLBACK;
