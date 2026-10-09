-- Fase 2, tarefa 9 — migration 20261031000008_painel_farmacia.sql: faltas
-- abertas priorizadas (alta vigilância, pacientes afetados, setores), retorno
-- da farmácia só por inserção e visível na prescrição.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'farmaceutico');
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;
UPDATE public.faltas_medicamento SET situacao = 'reposta' WHERE unidade_id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Morfina', 'morfina', 'solução injetável 10 mg/mL (teste painel)', 'teste-painel'),
  ('Dipirona', 'dipirona', 'comprimido 500 mg (teste painel)', 'teste-painel');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento WHERE fonte = 'teste-painel';
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Painel Farmácia Teste","data_nascimento":"1970-01-01"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":90,"frequencia-respiratoria":18,"temperatura":36.8,"saturacao-o2":97,"escala-dor":8,"pressao-arterial-sistolica":130,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('morfina'), 'dose', '2 mg', 'via', 'EV', 'posologia', 'agora')::jsonb);
-- plantão sinaliza as duas faltas (dipirona primeiro)
INSERT INTO t SELECT 'f_dip', public.sinalizar_falta('21000000-0000-4000-8000-000000000001', pg_temp.u('dipirona'), 'acabou no setor')::text;
INSERT INTO t SELECT 'f_mor', public.sinalizar_falta('21000000-0000-4000-8000-000000000001', pg_temp.u('morfina'), 'última ampola')::text;
DO $$ BEGIN
  PERFORM public.registrar_retorno_falta(pg_temp.u('f_mor'), 'Usar a do carrinho');
  RAISE EXCEPTION 'FALHOU: médico deu retorno';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  retorno é do farmacêutico';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.registrar_retorno_falta(pg_temp.u('f_mor'), 'Chega amanhã 8h; até lá, pedir à farmácia central');
INSERT INTO t SELECT 'painel', public.faltas_priorizadas('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'presc', public.falta_do_medicamento('21000000-0000-4000-8000-000000000001', pg_temp.u('morfina'))::text;
DO $$ BEGIN
  PERFORM public.faltas_priorizadas('21000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: médico viu o painel';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  painel é do farmacêutico e do gestor';
END $$;
RESET ROLE;

DO $$
DECLARE p jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'painel'); r jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'presc');
BEGIN
  IF jsonb_array_length(p) <> 2 OR p -> 0 ->> 'principio_ativo' <> 'Morfina' OR NOT (p -> 0 ->> 'alta_vigilancia')::boolean
     OR (p -> 0 ->> 'pacientes')::int <> 1 OR jsonb_array_length(p -> 0 -> 'setores') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: prioridade e impacto (%)', p;
  END IF;
  RAISE NOTICE 'OK  morfina (alta vigilância, 1 paciente, 1 setor) vem antes da dipirona, sinalizada antes';
  IF p -> 0 #>> '{retorno,texto}' NOT LIKE 'Chega amanhã%' OR r #>> '{retorno,texto}' NOT LIKE 'Chega amanhã%' OR r ->> 'situacao' <> 'registrada' THEN
    RAISE EXCEPTION 'FALHOU: retorno no painel e na prescrição (% / %)', p -> 0 -> 'retorno', r;
  END IF;
  RAISE NOTICE 'OK  retorno da farmácia aparece no painel e para quem prescreve';
  BEGIN
    UPDATE public.retornos_falta SET texto = 'outro' WHERE falta_id = pg_temp.u('f_mor');
    RAISE EXCEPTION 'FALHOU: retorno alterado';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  retorno só de inserção';
  IF has_table_privilege('authenticated', 'public.retornos_falta', 'INSERT')
     OR has_function_privilege('anon', 'public.faltas_priorizadas(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: exposto'; END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
