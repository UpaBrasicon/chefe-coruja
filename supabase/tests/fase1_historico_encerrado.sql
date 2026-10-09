-- Fase 1, tarefa 8 — migration 20261030000002_historico_encerrado.sql: quem
-- cuida do paciente agora vê o resumo dos atendimentos encerrados da unidade e
-- abre o detalhe com motivo (12 h, só leitura), registrado no acesso.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- o plantonista (…02) de plantão agora na Clínica Médica, com check-in
DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.perfil_id = '10000000-0000-4000-8000-000000000002' AND e.inicio <= now()
ON CONFLICT DO NOTHING;

-- paciente internado agora na Clínica Médica; dois atendimentos encerrados no PS (fora do plantão)
INSERT INTO public.pacientes (id, unidade_id, nome, setor_id) VALUES
  ('00000000-0000-4000-8000-0000000a8001', '21000000-0000-4000-8000-000000000001', 'Paciente do Histórico', '22000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-0000000a8002', '21000000-0000-4000-8000-000000000001', 'Paciente de Outro Setor', '22000000-0000-4000-8000-000000000003');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, cor_atual,
                              atendimento_medico_id, desfecho, desfecho_detalhes, encerrado_em) VALUES
  ('00000000-0000-4000-8000-0000000a8e01', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000a8001',
   '22000000-0000-4000-8000-000000000003', 'encerrado', 'Dor lombar', '10000000-0000-4000-8000-000000000004',
   now() - interval '90 days', 'verde', '10000000-0000-4000-8000-000000000002', 'alta', '{"cid_alta": "M54.5"}',
   now() - interval '90 days' + interval '2 hours'),
  ('00000000-0000-4000-8000-0000000a8e02', '21000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000a8001',
   '22000000-0000-4000-8000-000000000003', 'encerrado', 'Febre', '10000000-0000-4000-8000-000000000004',
   now() - interval '10 days', 'amarelo', '10000000-0000-4000-8000-000000000002', 'observacao', NULL,
   now() - interval '10 days' + interval '1 hour');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, data_alta, episodio_id, cid_alta)
SELECT u.organizacao_id, u.id, '00000000-0000-4000-8000-0000000a8001', x.st, '22000000-0000-4000-8000-000000000001',
       x.adm, x.alta, x.ep::uuid, x.cid
  FROM public.unidades u,
       (VALUES ('alta_melhorada', now() - interval '10 days' + interval '1 hour', now() - interval '8 days', '00000000-0000-4000-8000-0000000a8e02', 'J18.9'),
               ('internado', now() - interval '2 hours', NULL::timestamptz, NULL, NULL)) x(st, adm, alta, ep, cid)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';

CREATE FUNCTION pg_temp.como(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE TEMP TABLE r (v jsonb);
GRANT ALL ON r TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO r SELECT public.historico_encerrado('00000000-0000-4000-8000-0000000a8001');
DO $$
DECLARE v jsonb := (SELECT v FROM r);
BEGIN
  IF jsonb_array_length(v -> 'atendimentos') <> 2 THEN RAISE EXCEPTION 'FALHOU: 2 encerrados (a internação aberta não entra): %', v; END IF;
  IF NOT (v ->> 'pode_abrir_detalhe')::boolean THEN RAISE EXCEPTION 'FALHOU: quem cuida pode abrir o detalhe'; END IF;
  IF v #>> '{atendimentos,0,cid}' <> 'J18.9' OR v #>> '{atendimentos,0,desfecho}' <> 'alta_melhorada' THEN
    RAISE EXCEPTION 'FALHOU: o desfecho final é o da observação/internação: %', v -> 'atendimentos' -> 0;
  END IF;
  IF v #>> '{atendimentos,1,cid}' <> 'M54.5' OR v #>> '{atendimentos,1,cor}' <> 'verde' OR v #>> '{atendimentos,1,setor}' <> 'Pronto Socorro' THEN
    RAISE EXCEPTION 'FALHOU: resumo do atendimento da porta: %', v -> 'atendimentos' -> 1;
  END IF;
  IF (v #>> '{atendimentos,1}') LIKE '%Dor lombar%' THEN RAISE EXCEPTION 'FALHOU: resumo não leva texto clínico'; END IF;
  -- antes do motivo: o atendimento do PS (fora do plantão) não se lê
  IF EXISTS (SELECT 1 FROM public.episodios WHERE id = '00000000-0000-4000-8000-0000000a8e01') THEN
    RAISE EXCEPTION 'FALHOU: leu o detalhe sem motivo';
  END IF;
  RAISE NOTICE 'OK  resumo: 2 encerrados, CID e desfecho final, sem texto clínico; detalhe fechado sem motivo';
END $$;

DO $$ BEGIN
  PERFORM public.abrir_historico_encerrado('00000000-0000-4000-8000-0000000a8001', 'curto');
  RAISE EXCEPTION 'FALHOU: aceitou motivo curto';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  motivo curto recusado';
END $$;
SELECT public.abrir_historico_encerrado('00000000-0000-4000-8000-0000000a8001', 'Pneumonia de repetição: comparar com a internação anterior');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = '00000000-0000-4000-8000-0000000a8e01') THEN
    RAISE EXCEPTION 'FALHOU: com motivo, o detalhe abre';
  END IF;
  IF ((public.historico_encerrado('00000000-0000-4000-8000-0000000a8001') ->> 'detalhe_liberado_ate')::timestamptz) < now() + interval '11 hours' THEN
    RAISE EXCEPTION 'FALHOU: liberado por 12 horas';
  END IF;
  RAISE NOTICE 'OK  com motivo, o detalhe abre por 12 horas';
END $$;
-- paciente que não está no meu plantão: sem resumo e sem abrir
DO $$ BEGIN
  PERFORM public.abrir_historico_encerrado('00000000-0000-4000-8000-0000000a8002', 'Quero ver o histórico deste paciente');
  RAISE EXCEPTION 'FALHOU: abriu paciente que não cuida';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  paciente fora do meu cuidado: recusado (fica o pedido ao gestor)';
END $$;
-- enfermeiro não abre por motivo (decisão do RT: o médico que cuida)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  PERFORM public.abrir_historico_encerrado('00000000-0000-4000-8000-0000000a8001', 'Conferir a internação anterior');
  RAISE EXCEPTION 'FALHOU: enfermeiro abriu por motivo';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK  enfermeiro: recusado';
END $$;
-- o gestor vê o acesso com o motivo na Auditoria
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.acessos_prontuario_da_unidade('21000000-0000-4000-8000-000000000001') a
                  WHERE a.paciente_id = '00000000-0000-4000-8000-0000000a8001'
                    AND a.motivo = 'Pneumonia de repetição: comparar com a internação anterior') THEN
    RAISE EXCEPTION 'FALHOU: Auditoria sem o motivo';
  END IF;
  RAISE NOTICE 'OK  gestor vê quem, quando e o motivo';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.historico_encerrado(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.abrir_historico_encerrado(uuid, text)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'private.acessos_historico', 'SELECT') THEN RAISE EXCEPTION 'FALHOU: exposto'; END IF;
  RAISE NOTICE 'OK  fora do anon; tabela de acessos fora da API';
END $$;
ROLLBACK;
