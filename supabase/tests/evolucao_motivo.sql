-- Testes da migration 20270203000003_evolucao_motivo.sql (ponto 9 do
-- plantonista, regra B do RT): o médico de plantão no setor do CADASTRO do
-- paciente evolui, mesmo com a internação em outro setor; os outros tipos de
-- registro seguem só o setor da internação; e por_que_nao_evoluo diz o motivo
-- (papel, sem plantão, encerrada). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
-- médico (…0002), enfermeira (…0004) e recepção (…0005) de plantão só no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
                    '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id IS NOT NULL AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;

-- paciente cadastrado no PS (ficha da recepção) e internado na Observação
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', NULL,
  '{"nome":"Paciente Do Motivo","data_nascimento":"1975-05-05"}'::jsonb) ->> 'episodio_id';
RESET ROLE;
INSERT INTO t SELECT 'pac', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep');
UPDATE public.pacientes SET setor_id = '22000000-0000-4000-8000-000000000003' WHERE id = pg_temp.u('pac');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, setor_atual_id, status)
SELECT u.organizacao_id, u.id, pg_temp.u('pac'), '22000000-0000-4000-8000-000000000002', 'internado'
  FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO t SELECT 'int', id::text FROM public.internacoes WHERE paciente_id = pg_temp.u('pac') AND data_alta IS NULL;

DO $$
DECLARE i public.internacoes;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = pg_temp.u('int');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
  -- pré-condição: pela regra antiga (só o setor da internação) ele NÃO evoluía
  IF private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'FALHOU: pré-condição — o médico já cuidava pelo setor da internação'; END IF;
  RAISE NOTICE 'OK  pré-condição: pela regra antiga o médico do PS não evolui o internado da Observação';
END $$;

-- regra B: o médico de plantão no setor do cadastro evolui
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
DECLARE m jsonb := public.por_que_nao_evoluo(pg_temp.u('int'));
BEGIN
  IF (m ->> 'pode')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: médico do setor do cadastro devia poder — %', m; END IF;
  IF (public.contexto_evolucao(pg_temp.u('int')) ->> 'pode_registrar')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: contexto_evolucao não concorda com por_que_nao_evoluo';
  END IF;
  RAISE NOTICE 'OK  médico do setor do cadastro pode evoluir (motivo e contexto concordam)';
END $$;
SELECT public.registrar_evolucao(pg_temp.u('int'), 'evolucao', 'Paciente estável, sem queixas novas. Mantida conduta.');
DO $$ BEGIN RAISE NOTICE 'OK  registrar_evolucao aceita a evolução médica pela regra B'; END $$;

-- os outros tipos não mudam: a enfermeira do PS continua barrada na Observação
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format($q$SELECT public.registrar_evolucao(%L, 'evolucao_enfermagem', 'Paciente sem queixas, aceitando dieta.')$q$, pg_temp.u('int')),
  'Acesso negado: você não está de plantão', 'evolução de enfermagem segue só o setor da internação');

-- recepção lê o paciente (cadastro no PS), mas o papel não evolui
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE m jsonb := public.por_que_nao_evoluo(pg_temp.u('int'));
BEGIN
  IF m ->> 'motivo' IS DISTINCT FROM 'papel' THEN RAISE EXCEPTION 'FALHOU: motivo da recepção — %', m; END IF;
  RAISE NOTICE 'OK  recepção: motivo papel';
END $$;

-- gestor sem plantão: lê, não evolui, motivo sem_plantao
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE m jsonb := public.por_que_nao_evoluo(pg_temp.u('int'));
BEGIN
  IF m ->> 'motivo' IS DISTINCT FROM 'sem_plantao' OR (m ->> 'pode')::boolean THEN RAISE EXCEPTION 'FALHOU: motivo do gestor — %', m; END IF;
  RAISE NOTICE 'OK  gestor sem plantão: motivo sem_plantao';
END $$;

-- encerrada vem antes de qualquer outro motivo
RESET ROLE;
UPDATE public.internacoes SET status = 'alta_melhorada', data_alta = now() WHERE id = pg_temp.u('int');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE m jsonb := public.por_que_nao_evoluo(pg_temp.u('int'));
BEGIN
  IF m ->> 'motivo' IS DISTINCT FROM 'encerrada' THEN RAISE EXCEPTION 'FALHOU: motivo da encerrada — %', m; END IF;
  RAISE NOTICE 'OK  internação encerrada: motivo encerrada';
END $$;
RESET ROLE;
ROLLBACK;
