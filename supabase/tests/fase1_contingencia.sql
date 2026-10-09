-- Fase 1, tarefa 12 — migration 20261030000006_contingencia.sql: período de
-- contingência registrado pelo coordenador (ou gestor) e marca de reentrada no
-- atendimento; só inserção; quem não é de plantão não registra.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- o plantonista (…02) de plantão agora na Clínica Médica, com check-in
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '3 hours', 720);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.perfil_id = '10000000-0000-4000-8000-000000000002' AND e.inicio <= now()
ON CONFLICT DO NOTHING;
-- paciente atendido durante a queda (chegou no meio dela), na Clínica Médica
INSERT INTO public.pacientes (id, unidade_id, nome, setor_id)
VALUES ('00000000-0000-4000-8000-0000000c1201', '21000000-0000-4000-8000-000000000001', 'Paciente da Contingência', '22000000-0000-4000-8000-000000000001');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('00000000-0000-4000-8000-0000000c12e1', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c1201',
        '22000000-0000-4000-8000-000000000001', 'atendimento', 'Dispneia', '10000000-0000-4000-8000-000000000004', now() - interval '90 minutes');

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;

SET LOCAL ROLE authenticated;
-- o coordenador (plantonista de plantão) registra o período, depois que o sistema voltou
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'c', public.registrar_contingencia('21000000-0000-4000-8000-000000000001',
  now() - interval '2 hours', now() - interval '30 minutes', 'Queda de internet da unidade (operadora)')::text;
DO $$ BEGIN
  PERFORM public.registrar_contingencia('21000000-0000-4000-8000-000000000001', now() - interval '1 hour', now() - interval '40 minutes', 'Período sobreposto ao anterior');
  RAISE EXCEPTION 'FALHOU: aceitou período sobreposto';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
END $$;
DO $$ BEGIN
  PERFORM public.registrar_contingencia('21000000-0000-4000-8000-000000000001', now() - interval '20 minutes', now() + interval '1 hour', 'Fim no futuro, ainda caído');
  RAISE EXCEPTION 'FALHOU: aceitou fim no futuro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  coordenador de plantão registra o período; recusa sobreposição e fim no futuro';
END $$;
-- marca a reentrada no atendimento
INSERT INTO t SELECT 'r', public.marcar_reentrada_contingencia('00000000-0000-4000-8000-0000000c12e1', (SELECT v FROM t WHERE k = 'c')::uuid,
  'Classificação amarela às 08:40 e prescrição de dipirona no papel (ficha C-03, anexada)')::text;
DO $$
DECLARE r jsonb := public.reentradas_do_episodio('00000000-0000-4000-8000-0000000c12e1');
BEGIN
  IF jsonb_array_length(r) <> 1 OR r -> 0 ->> 'descricao' NOT LIKE '%C-03%' THEN RAISE EXCEPTION 'FALHOU: marca de reentrada %', r; END IF;
  IF ((public.contingencias_da_unidade('21000000-0000-4000-8000-000000000001') -> 0) ->> 'reentradas')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: contagem de reentradas na contingência';
  END IF;
  RAISE NOTICE 'OK  reentrada marcada no atendimento, com descrição e autor; contada na contingência';
END $$;
-- recepção (fora de plantão clínico) não registra contingência
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  PERFORM public.registrar_contingencia('21000000-0000-4000-8000-000000000001', now() - interval '5 hours', now() - interval '4 hours', 'Tentativa da recepção');
  RAISE EXCEPTION 'FALHOU: recepção registrou contingência';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  recepção: recusado';
END $$;
RESET ROLE;
-- só inserção
DO $$ BEGIN
  UPDATE public.contingencias SET motivo = 'alterado depois' WHERE id = (SELECT v FROM t WHERE k = 'c')::uuid;
  RAISE EXCEPTION 'FALHOU: contingência alterada';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  contingência e reentrada não se alteram';
END $$;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'public.contingencias', 'INSERT')
     OR has_function_privilege('anon', 'public.registrar_contingencia(uuid, timestamptz, timestamptz, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
