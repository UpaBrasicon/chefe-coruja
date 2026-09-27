-- Testes da migration 20260927000006_hermes_verificacoes.sql. ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/hermes_verificacoes.sql
BEGIN;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('21000000-0000-4000-8000-0000000000b2', '20000000-0000-4000-8000-000000000001', 'Outra Unidade', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  ('22000000-0000-4000-8000-0000000000b2', '21000000-0000-4000-8000-0000000000b2', 'Porta B', 'emergencia');

ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  -- mesma unidade, dois setores ao mesmo tempo: legítimo
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360),
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.hermes_plantoes_sobrepostos() WHERE perfil_id = '10000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'FALHOU: dois setores da mesma unidade viraram sobreposição';
  END IF;
  RAISE NOTICE 'OK  vários setores da mesma unidade ao mesmo tempo não é sobreposição';
END $$;

ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-0000000000b2', '22000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-000000000002', private.data_atual(), 'manha', now() + interval '2 hours', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.hermes_plantoes_sobrepostos() WHERE perfil_id = '10000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: duas unidades ao mesmo tempo não detectado';
  END IF;
  RAISE NOTICE 'OK  duas unidades com janelas que se cruzam é sobreposição';
  IF EXISTS (SELECT 1 FROM public.hermes_setores_ocupados_sem_plantao() WHERE setor_id = '22000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: setor com plantão em curso acusado de sem médico';
  END IF;
  RAISE NOTICE 'OK  setor com plantão em curso (pela janela) não é acusado';
END $$;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.hermes_perfis_sem_vinculo();
  RAISE EXCEPTION 'FALHOU: usuário comum executou verificação do Hermes';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  verificações só para o service role';
END $$;
RESET ROLE;
ROLLBACK;
