-- Testes da migration 20261127000001_conta_atendimento.sql (Fase 5B, tarefa 1):
-- a conta abre sozinha com o atendimento (porta) e com a internação (ligada à
-- da porta); etapas aberta → em conferência → fechada → faturada; o
-- faturamento conduz, o gestor reabre; pagador da categoria, troca registrada.
-- ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- a recepção de teste também tem o papel faturamento nesta unidade
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'faturamento') ON CONFLICT DO NOTHING;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, categoria) VALUES
  ('23000000-0000-4000-8000-0000000f5001', '21000000-0000-4000-8000-000000000001', 'Conta Da Porta', '1970-01-01', 'F5-1', NULL),
  ('23000000-0000-4000-8000-0000000f5002', '21000000-0000-4000-8000-000000000001', 'Conta Encerrada', '1971-01-01', 'F5-2', 'particular');
-- atendimento em andamento e outro já encerrado
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em) VALUES
  ('25000000-0000-4000-8000-0000000f5001', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000f5001',
   '22000000-0000-4000-8000-000000000003', 'atendimento', 'Dor', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, desfecho, desfecho_em, encerrado_em) VALUES
  ('25000000-0000-4000-8000-0000000f5002', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000f5002',
   '22000000-0000-4000-8000-000000000003', 'encerrado', 'Corte', '10000000-0000-4000-8000-000000000004', now() - interval '5 hours',
   'alta', now() - interval '4 hours', now() - interval '4 hours');

CREATE TEMP TABLE t (k text PRIMARY KEY, v text);
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT v::uuid FROM t WHERE k = p $$;
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

INSERT INTO t SELECT 'a1', id::text FROM public.contas WHERE episodio_id = '25000000-0000-4000-8000-0000000f5001';
INSERT INTO t SELECT 'a2', id::text FROM public.contas WHERE episodio_id = '25000000-0000-4000-8000-0000000f5002';
DO $$ BEGIN
  IF pg_temp.u('a1') IS NULL OR pg_temp.u('a2') IS NULL THEN RAISE EXCEPTION 'FALHOU: atendimento sem conta'; END IF;
  IF (SELECT tipo || '|' || status || '|' || pagador || '|' || (numero LIKE 'A-____.______')::text FROM public.contas WHERE id = pg_temp.u('a1'))
     <> 'ambulatorial|aberta|sus|true' THEN RAISE EXCEPTION 'FALHOU: conta da porta'; END IF;
  IF (SELECT pagador FROM public.contas WHERE id = pg_temp.u('a2')) <> 'particular' THEN
    RAISE EXCEPTION 'FALHOU: pagador deveria vir da categoria do paciente';
  END IF;
  RAISE NOTICE 'OK  3a/6a: o atendimento abre a conta ambulatorial, com o pagador da categoria (SUS sem categoria)';
END $$;

-- 2a. observação fica na conta da porta; a de internação nasce na internação, ligada à da porta
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id)
VALUES ('26000000-0000-4000-8000-0000000f5001', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
        '23000000-0000-4000-8000-0000000f5001', 'em_observacao', '22000000-0000-4000-8000-000000000002', now() - interval '2 hours',
        '25000000-0000-4000-8000-0000000f5001');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000f5001') THEN
    RAISE EXCEPTION 'FALHOU: observação abriu conta de internação';
  END IF;
  RAISE NOTICE 'OK  2a: observação continua na conta da porta';
END $$;
UPDATE public.internacoes SET internado_em = now(), status = 'internado' WHERE id = '26000000-0000-4000-8000-0000000f5001';
INSERT INTO t SELECT 'i1', id::text FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-0000000f5001';
DO $$ BEGIN
  IF (SELECT tipo || '|' || conta_origem_id || '|' || (numero LIKE 'I-%')::text FROM public.contas WHERE id = pg_temp.u('i1'))
     <> 'internacao|' || pg_temp.u('a1') || '|true' THEN
    RAISE EXCEPTION 'FALHOU: conta de internação sem o link para a da porta';
  END IF;
  RAISE NOTICE 'OK  2a: ao internar, nasce a conta de internação ligada à da porta';
END $$;

-- leitura: enfermagem não vê; faturamento vê a ligação nas duas pontas
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.contas_da_unidade('21000000-0000-4000-8000-000000000001')$$, 'Acesso negado', 'enfermagem não vê as contas');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('a1'));
BEGIN
  IF d -> 'derivadas' -> 0 ->> 'id' <> pg_temp.u('i1')::text OR (d ->> 'atendimento_terminou')::boolean
     OR NOT (d ->> 'pode_conduzir')::boolean OR (d ->> 'pode_reabrir')::boolean THEN
    RAISE EXCEPTION 'FALHOU: detalhe da conta da porta: %', d;
  END IF;
  IF (public.contas_da_unidade('21000000-0000-4000-8000-000000000001', 'aberta') -> 'totais' ->> 'aberta')::int < 3 THEN
    RAISE EXCEPTION 'FALHOU: lista de contas';
  END IF;
  RAISE NOTICE 'OK  faturamento vê a lista e as duas pontas da ligação';
END $$;

-- 4a/5a. etapas
SELECT public.mudar_etapa_conta(pg_temp.u('a1'), 'em_conferencia');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L)', pg_temp.u('a1'), 'fechada'),
  'O atendimento ainda não terminou', 'conta não fecha antes do desfecho');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L)', pg_temp.u('a1'), 'aberta'),
  'Diga por que a conta volta a aberta', 'voltar a aberta pede motivo');
SELECT public.mudar_etapa_conta(pg_temp.u('a1'), 'aberta', 'faltou o procedimento da sutura');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L)', pg_temp.u('a2'), 'faturada'),
  'Mudança de etapa não permitida: de aberta para faturada', 'não pula etapa');
SELECT public.trocar_pagador_conta(pg_temp.u('a2'), 'sus', 'paciente apresentou cartão SUS e quer pelo SUS');
SELECT public.mudar_etapa_conta(pg_temp.u('a2'), 'em_conferencia');
-- Fase 5B, tarefa 5: a conta de teste tem pendência bloqueante; o gestor libera
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.liberar_fechamento_conta(pg_temp.u('a2'), 'liberado no teste da tarefa anterior');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('a2'), 'fechada');
SELECT pg_temp.falha(format('SELECT public.trocar_pagador_conta(%L, %L, %L)', pg_temp.u('a2'), 'particular', 'mudou de ideia de novo'),
  'Conta fechada: o gestor reabre', 'pagador não muda com a conta fechada');
SELECT public.mudar_etapa_conta(pg_temp.u('a2'), 'faturada');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L, %L)', pg_temp.u('a2'), 'aberta', 'glosa do município'),
  'Reabrir conta fechada é do gestor', 'faturamento não reabre');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L)', pg_temp.u('a2'), 'aberta'),
  'Diga por que a conta é reaberta', 'gestor reabre só com motivo');
SELECT pg_temp.falha(format('SELECT public.mudar_etapa_conta(%L, %L)', pg_temp.u('a1'), 'em_conferencia'),
  'A conferência é do faturamento', 'gestor não conduz a conferência');
SELECT public.mudar_etapa_conta(pg_temp.u('a2'), 'aberta', 'glosa do município: refazer o BPA');
RESET ROLE;
DO $$ BEGIN
  -- os eventos erp_* (Fase 5C-3) têm teste próprio em fase5c_erp_contas.sql
  IF (SELECT string_agg(evento, ',' ORDER BY em, evento) FROM public.conta_eventos WHERE conta_id = pg_temp.u('a2') AND evento NOT LIKE 'erp\_%')
     NOT LIKE 'aberta,%pagador%'
     OR (SELECT count(*) FROM public.conta_eventos WHERE conta_id = pg_temp.u('a2') AND evento NOT LIKE 'erp\_%') <> 7 THEN  -- 7 com a liberação do gestor (tarefa 5)
    RAISE EXCEPTION 'FALHOU: histórico da conta: %', (SELECT string_agg(evento, ',' ORDER BY em) FROM public.conta_eventos WHERE conta_id = pg_temp.u('a2'));
  END IF;
  IF (SELECT status || '|' || pagador FROM public.contas WHERE id = pg_temp.u('a2')) <> 'aberta|sus' THEN
    RAISE EXCEPTION 'FALHOU: estado final da conta encerrada';
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade_id = pg_temp.u('a2') AND acao LIKE 'conta_%') <> 6 THEN  -- 6 com a liberação do gestor (tarefa 5)
    RAISE EXCEPTION 'FALHOU: auditoria das mudanças da conta';
  END IF;
  IF has_table_privilege('authenticated', 'public.contas', 'INSERT') OR has_table_privilege('authenticated', 'public.contas', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHOU: conta gravável por fora das funções';
  END IF;
  RAISE NOTICE 'OK  4a/5a/6a: etapas, motivo, reabertura do gestor, troca de pagador; histórico e auditoria';
END $$;
ROLLBACK;
