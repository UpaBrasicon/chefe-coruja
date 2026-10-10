-- Fase 3, tarefa 1 — migrations 20261102000001_papel_regulador.sql e
-- 20261102000002_aih_ciclo.sql: a AIH nasce do laudo, uma ativa por
-- internação; o médico regulador aprova (número de 13 dígitos e competência)
-- ou rejeita (motivo); competência ajustável com motivo; cancelamento; tudo
-- no histórico só de inserção.
--
-- Perfis do seed: gestor (…01), plantonista (…02, escalado aqui na Clínica
-- Médica) e o perfil …06, que vira regulador com CRM.
BEGIN;
-- banco limpo (CI) não tem a CID-10 carregada; a crítica da AIH confere o CID na tabela
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('J18.9', 'CID do teste J18.9') ON CONFLICT DO NOTHING;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, raca_cor, nome_mae, endereco, municipio, uf)
VALUES ('23000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000001', 'Paciente do Teste da AIH',
        '1965-04-04', 'T-097', '22000000-0000-4000-8000-000000000001', 'M', '898001160012344', 'parda',
        'Mãe do Teste da AIH', 'Rua do Teste, 97', 'São Paulo', 'SP');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('25000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000097',
        '22000000-0000-4000-8000-000000000001', 'atendimento', 'Dispneia', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id)
SELECT '24000000-0000-4000-8000-000000000097', u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000097',
       'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 hour', '25000000-0000-4000-8000-000000000097'
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min) VALUES
  ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   private.data_atual(), private.turno_atual(), now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.ativo AND e.perfil_id = '10000000-0000-4000-8000-000000000002' AND e.inicio <= now()
   AND now() < e.inicio + make_interval(mins => e.duracao_min)
ON CONFLICT DO NOTHING;

-- a gestora (…01) não é reguladora neste teste
UPDATE public.vinculos SET ativo = false WHERE perfil_id = '10000000-0000-4000-8000-000000000001' AND papel = 'regulador';
-- …06 vira médico regulador, com CRM
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'regulador')
ON CONFLICT DO NOTHING;
UPDATE public.perfis SET crm = coalesce(crm, '123456'), uf_crm = coalesce(uf_crm, 'SP') WHERE id = '10000000-0000-4000-8000-000000000006';

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;
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
CREATE FUNCTION pg_temp.laudo(diag text) RETURNS text LANGUAGE sql AS $$
  SELECT json_build_object('aih', json_build_object('cid', 'J18.9', 'procCod', '03.03.14.008-9', 'procDesc', 'Tratamento de pneumonias',
    'sinais', 'Febre, tosse e dispneia', 'condicoes', 'Hipoxemia em ar ambiente', 'diagnostico', diag, 'clinica', 'Clínica médica'))::text $$;
GRANT EXECUTE ON FUNCTION pg_temp.laudo(text) TO authenticated;
CREATE FUNCTION pg_temp.status(p_aih uuid) RETURNS text LANGUAGE sql AS $$ SELECT status FROM public.aihs WHERE id = p_aih $$;

SET LOCAL ROLE authenticated;

-- ── 1. o laudo emitido cria a AIH solicitada, ligada à internação ────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.abrir_prontuario('23000000-0000-4000-8000-000000000097', NULL);
INSERT INTO t SELECT 'laudo1', public.emitir_documento('23000000-0000-4000-8000-000000000097', 'laudo_aih', pg_temp.laudo('Pneumonia comunitária')) ->> 'id';
RESET ROLE;
INSERT INTO t SELECT 'aih1', id::text FROM public.aihs WHERE paciente_id = '23000000-0000-4000-8000-000000000097';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.aihs WHERE paciente_id = '23000000-0000-4000-8000-000000000097') <> 1
     OR pg_temp.status(pg_temp.u('aih1')) <> 'solicitada'
     OR (SELECT internacao_id FROM public.aihs WHERE id = pg_temp.u('aih1')) <> '24000000-0000-4000-8000-000000000097'
     OR (SELECT laudo_id FROM public.aihs WHERE id = pg_temp.u('aih1')) <> pg_temp.u('laudo1') THEN
    RAISE EXCEPTION 'FALHOU: AIH não nasceu do laudo como solicitada da internação';
  END IF;
  RAISE NOTICE 'OK  laudo emitido cria a AIH solicitada, ligada à internação';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');

-- uma ativa por internação: outro laudo (não retificação) é recusado
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L)', '23000000-0000-4000-8000-000000000097', 'laudo_aih',
  pg_temp.laudo('Outro laudo da mesma internação')), 'Já existe AIH solicitada ou aprovada', 'segunda AIH ativa na mesma internação');
-- retificar o laudo da AIH solicitada atualiza a mesma AIH
INSERT INTO t SELECT 'laudo2', public.emitir_documento('23000000-0000-4000-8000-000000000097', 'laudo_aih',
  pg_temp.laudo('Pneumonia comunitária grave'), NULL, pg_temp.u('laudo1'), 'Diagnóstico revisto após radiografia') ->> 'id';
-- o médico não decide
SELECT pg_temp.falha(format('SELECT public.decidir_aih(%L, true, %L)', pg_temp.u('aih1'), '1234567890123'),
  'A decisão da AIH é do médico regulador', 'médico sem papel de regulador não aprova');
INSERT INTO t SELECT 'dos_laudos', public.aihs_dos_laudos(ARRAY[pg_temp.u('laudo2')])::text;

-- ── 2. o regulador aprova, com número e competência sugerida ────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'fila', public.aihs_da_unidade('21000000-0000-4000-8000-000000000001', 'solicitada')::text;
SELECT pg_temp.falha(format('SELECT public.decidir_aih(%L, true, %L)', pg_temp.u('aih1'), '12345'),
  'Número da AIH: 13 dígitos', 'número fora do formato');
SELECT pg_temp.falha(format('SELECT public.decidir_aih(%L, false, NULL, NULL, %L)', pg_temp.u('aih1'), 'curto'),
  'Rejeitar exige motivo', 'rejeitar sem motivo');
SELECT public.decidir_aih(pg_temp.u('aih1'), true, '3526199900011', NULL, NULL);
SELECT pg_temp.falha(format('SELECT public.decidir_aih(%L, true, %L)', pg_temp.u('aih1'), '3526199900012'),
  'Só se decide AIH solicitada', 'AIH já decidida não se decide de novo');
-- competência: formato e motivo
SELECT pg_temp.falha(format('SELECT public.ajustar_competencia_aih(%L, %L, %L)', pg_temp.u('aih1'), '202613', 'Alta no mês seguinte ao previsto'),
  'Competência no formato AAAAMM', 'competência com mês 13');
SELECT pg_temp.falha(format('SELECT public.ajustar_competencia_aih(%L, %L, %L)', pg_temp.u('aih1'), '203001', 'curto'),
  'Ajustar a competência exige motivo', 'ajuste sem motivo');
SELECT public.ajustar_competencia_aih(pg_temp.u('aih1'), '203001', 'Apresentação na competência seguinte por fechamento');

-- ── 3. AIH aprovada: laudo não se retifica; médico não cancela ──────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L, NULL, %L, %L)', '23000000-0000-4000-8000-000000000097', 'laudo_aih',
  pg_temp.laudo('Mais uma revisão'), pg_temp.u('laudo2'), 'Revisão depois da aprovação'), 'AIH já aprovada', 'laudo de AIH aprovada não se retifica');
SELECT pg_temp.falha(format('SELECT public.cancelar_aih(%L, %L)', pg_temp.u('aih1'), 'Paciente transferido para outro serviço'),
  'Cancela a AIH o regulador', 'médico não cancela AIH aprovada');

-- ── 4. o regulador cancela; a internação pode pedir outra AIH ────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha(format('SELECT public.cancelar_aih(%L, %L)', pg_temp.u('aih1'), 'curto'), 'Cancelar exige motivo', 'cancelar sem motivo');
SELECT public.cancelar_aih(pg_temp.u('aih1'), 'Procedimento principal mudou, nova AIH');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'laudo3', public.emitir_documento('23000000-0000-4000-8000-000000000097', 'laudo_aih', pg_temp.laudo('Pneumonia com derrame pleural')) ->> 'id';
RESET ROLE;
INSERT INTO t SELECT 'aih2', id::text FROM public.aihs WHERE laudo_id = pg_temp.u('laudo3');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT public.decidir_aih(pg_temp.u('aih2'), false, NULL, NULL, 'Laudo sem exame que comprove o derrame');

-- ── 5. quem solicitou aprova só se também for regulador ─────────────────────
RESET ROLE;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'regulador') ON CONFLICT DO NOTHING;
UPDATE public.perfis SET crm = coalesce(crm, '654321'), uf_crm = coalesce(uf_crm, 'SP') WHERE id = '10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'laudo4', public.emitir_documento('23000000-0000-4000-8000-000000000097', 'laudo_aih', pg_temp.laudo('Pneumonia com derrame pleural confirmado')) ->> 'id';
RESET ROLE;
INSERT INTO t SELECT 'aih3', id::text FROM public.aihs WHERE laudo_id = pg_temp.u('laudo4');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.decidir_aih(%L, true, %L)', pg_temp.u('aih3'), '3526199900011'),
  'Este número de AIH já está em outra AIH', 'número repetido de outra AIH');
SELECT public.decidir_aih(pg_temp.u('aih3'), true, '3526199900013', '202610', NULL);
-- cancelar o laudo cancela a AIH
SELECT public.cancelar_documento(pg_temp.u('laudo4'), 'Laudo emitido para o paciente errado no plantão');

-- ── 6. gestor lê, não decide ────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'gestor', public.aihs_da_unidade('21000000-0000-4000-8000-000000000001')::text;
INSERT INTO t SELECT 'eventos1', public.eventos_aih(pg_temp.u('aih1'))::text;
SELECT pg_temp.falha(format('SELECT public.decidir_aih(%L, true, %L)', pg_temp.u('aih3'), '3526199900014'),
  'A decisão da AIH é do médico regulador', 'gestor não decide AIH');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.aihs_da_unidade(%L)', '21000000-0000-4000-8000-000000000001'),
  'AIH da unidade: regulador ou gestor', 'enfermagem não lê a fila da AIH');
RESET ROLE;

DO $$
DECLARE v jsonb; e jsonb;
BEGIN
  IF (SELECT laudo_id FROM public.aihs WHERE id = pg_temp.u('aih1')) <> pg_temp.u('laudo2') THEN
    RAISE EXCEPTION 'FALHOU: retificação não atualizou o laudo da AIH';
  END IF;
  RAISE NOTICE 'OK  retificar o laudo da AIH solicitada atualiza a mesma AIH';
  v := (SELECT valor FROM t WHERE nome = 'dos_laudos')::jsonb;
  IF v -> 0 ->> 'status' <> 'solicitada' OR v -> 0 ->> 'laudo_id' <> pg_temp.u('laudo2')::text THEN
    RAISE EXCEPTION 'FALHOU: aihs_dos_laudos (%)', v;
  END IF;
  RAISE NOTICE 'OK  o médico vê a AIH do laudo';
  v := (SELECT valor FROM t WHERE nome = 'fila')::jsonb;
  IF jsonb_array_length(v) < 1 OR v -> 0 ->> 'cid' <> 'J18.9' OR v -> 0 ->> 'proc_cod' <> '03.03.14.008-9'
     OR v -> 0 ->> 'competencia_sugerida' <> to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM') THEN
    RAISE EXCEPTION 'FALHOU: fila do regulador (%)', v -> 0;
  END IF;
  RAISE NOTICE 'OK  fila do regulador com dados do laudo e competência sugerida';
  e := (SELECT valor FROM t WHERE nome = 'eventos1')::jsonb;
  IF (SELECT string_agg(x ->> 'evento', ',') FROM jsonb_array_elements(e) x)
     <> 'solicitada,laudo_retificado,aprovada,competencia_ajustada,cancelada' THEN
    RAISE EXCEPTION 'FALHOU: histórico da AIH (%)', e;
  END IF;
  IF e -> 2 ->> 'numero' <> '3526199900011' OR e -> 2 ->> 'competencia' <> to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')
     OR e -> 3 ->> 'competencia' <> '203001' OR e -> 4 ->> 'motivo' <> 'Procedimento principal mudou, nova AIH' THEN
    RAISE EXCEPTION 'FALHOU: dados do histórico (%)', e;
  END IF;
  RAISE NOTICE 'OK  histórico: solicitada, retificação, aprovação (número e competência), ajuste e cancelamento';
  IF pg_temp.status(pg_temp.u('aih2')) <> 'rejeitada' OR (SELECT motivo FROM public.aihs WHERE id = pg_temp.u('aih2')) IS NULL THEN
    RAISE EXCEPTION 'FALHOU: rejeição';
  END IF;
  RAISE NOTICE 'OK  regulador rejeita com motivo; depois da cancelada, a internação pede outra AIH';
  IF pg_temp.status(pg_temp.u('aih3')) <> 'cancelada' OR (SELECT decidida_por FROM public.aihs WHERE id = pg_temp.u('aih3'))
     <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: autoaprovação do regulador ou cancelamento pelo laudo (%)', pg_temp.status(pg_temp.u('aih3'));
  END IF;
  RAISE NOTICE 'OK  quem é regulador aprova a própria AIH; cancelar o laudo cancela a AIH';
  IF (SELECT count(*) FROM jsonb_array_elements((SELECT valor FROM t WHERE nome = 'gestor')::jsonb) x
       WHERE x ->> 'paciente_id' = '23000000-0000-4000-8000-000000000097') <> 3 THEN
    RAISE EXCEPTION 'FALHOU: gestor deveria ver as 3 AIHs';
  END IF;
  RAISE NOTICE 'OK  gestor lê todas as AIHs da unidade';
  BEGIN
    UPDATE public.aih_eventos SET motivo = 'x' WHERE aih_id = pg_temp.u('aih1');
    RAISE EXCEPTION 'FALHOU: histórico alterado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  histórico só de inserção';
  IF has_table_privilege('authenticated', 'public.aihs', 'INSERT') OR has_table_privilege('authenticated', 'public.aihs', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.aih_eventos', 'INSERT')
     OR has_function_privilege('anon', 'public.decidir_aih(uuid, boolean, text, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.aihs_da_unidade(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: AIH exposta fora das RPCs';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
