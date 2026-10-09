-- Fase 2, tarefa 8 — migration 20261031000007_auditoria_clinica.sql: eventos
-- clínicos críticos deixam linha na trilha encadeada (por gatilho), com lista
-- fechada de campos; a cobertura conta o que ficou sem trilha; a cadeia segue
-- íntegra.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
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
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Ceftriaxona', 'ceftriaxona', 'pó injetável 1 g (teste audit)', 'teste-auditoria');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t SELECT principio_ativo_norm, id::text FROM public.medicamento WHERE fonte = 'teste-auditoria';
INSERT INTO t SELECT 'seq0', coalesce(max(seq), 0)::text FROM public.log_auditoria;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Auditoria Teste","data_nascimento":"1980-08-08"}'::jsonb) ->> 'episodio_id';
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.classificar_risco(pg_temp.u('ep'), 'amarelo',
  '{"frequencia-cardiaca":100,"frequencia-respiratoria":20,"temperatura":38.6,"saturacao-o2":97,"escala-dor":3,"pressao-arterial-sistolica":120,"pressao-arterial-diastolica":80}',
  (SELECT id FROM public.protocolo_fluxogramas WHERE nome = 'Alterações cutâneas' AND publico = 'adulto'), 'Edema de face');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.iniciar_atendimento(pg_temp.u('ep'));
SELECT public.registrar_soap(pg_temp.u('ep'), 'febre', 'exame', 'infecção', 'antibiótico', 'R50');
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'item', public.prescrever(pg_temp.u('pac'), json_build_object('medicamento_id', pg_temp.u('ceftriaxona'),
  'dose', '1 g', 'via', 'EV', 'posologia', '12/12h')::jsonb);
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT public.aprazar(pg_temp.u('item'), '{08:00,20:00}');
SELECT public.checar(pg_temp.u('item'), 'recusado', '08:00', 'paciente recusou a punção agora');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.suspender_item(pg_temp.u('item'), 'troca de antibiótico');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'cob', public.cobertura_auditoria_clinica('21000000-0000-4000-8000-000000000001', 1)::text;
RESET ROLE;

DO $$
DECLARE c jsonb := (SELECT valor::jsonb FROM t WHERE nome = 'cob'); s0 bigint := (SELECT valor::bigint FROM t WHERE nome = 'seq0');
        acoes text[]; p jsonb;
BEGIN
  SELECT array_agg(DISTINCT acao) INTO acoes FROM public.log_auditoria WHERE seq > s0;
  IF NOT acoes @> ARRAY['classificacao_risco', 'atendimento_registrado', 'prescricao_item_criado', 'prescricao_item_aprazado',
                        'administracao_registrada', 'prescricao_item_suspenso'] THEN
    RAISE EXCEPTION 'FALHOU: eventos sem trilha (%)', acoes;
  END IF;
  RAISE NOTICE 'OK  classificação, SOAP, prescrição, aprazamento, checagem e suspensão deixam linha na trilha';
  SELECT payload INTO p FROM public.log_auditoria WHERE seq > s0 AND acao = 'administracao_registrada';
  IF p <> '{"situacao":"recusado","horario":"08:00"}'::jsonb THEN RAISE EXCEPTION 'FALHOU: payload da checagem (%)', p; END IF;
  IF EXISTS (SELECT 1 FROM public.log_auditoria WHERE seq > s0 AND payload::text ~ '(recusou|antibiótico|febre|Auditoria Teste)') THEN
    RAISE EXCEPTION 'FALHOU: texto clínico ou nome na trilha';
  END IF;
  RAISE NOTICE 'OK  trilha guarda só campos da lista fechada (situação e horário), sem texto clínico nem nome';
  IF (SELECT ator_id FROM public.log_auditoria WHERE seq > s0 AND acao = 'administracao_registrada') <> '10000000-0000-4000-8000-000000000004' THEN
    RAISE EXCEPTION 'FALHOU: autor da checagem na trilha';
  END IF;
  RAISE NOTICE 'OK  autor na trilha = usuário do login';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(c -> 'eventos') e WHERE (e ->> 'sem_trilha')::int > 0) THEN
    RAISE EXCEPTION 'FALHOU: cobertura acusa registro sem trilha (%)', c;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c -> 'eventos') e WHERE e ->> 'evento' = 'Checagem (administrações)' AND (e ->> 'registros')::int >= 1) THEN
    RAISE EXCEPTION 'FALHOU: cobertura não contou a checagem (%)', c;
  END IF;
  RAISE NOTICE 'OK  cobertura: todos os registros clínicos do período têm a linha na trilha';
  IF private.verificar_cadeia_auditoria() IS NOT NULL AND private.verificar_cadeia_auditoria() > s0 THEN
    RAISE EXCEPTION 'FALHOU: cadeia quebrada nas linhas novas';
  END IF;
  RAISE NOTICE 'OK  cadeia de hash íntegra nas linhas novas';
  IF has_function_privilege('anon', 'public.cobertura_auditoria_clinica(uuid, integer)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon'; END IF;
  RAISE NOTICE 'OK  cobertura fora do anon';
END $$;
-- só o gestor vê a cobertura
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
DO $$ BEGIN
  PERFORM public.cobertura_auditoria_clinica('21000000-0000-4000-8000-000000000001', 1);
  RAISE EXCEPTION 'FALHOU: enfermagem viu a cobertura';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  só o gestor vê a cobertura';
END $$;
ROLLBACK;
