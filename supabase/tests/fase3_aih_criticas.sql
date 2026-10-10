-- Fase 3, tarefa 2 — migration 20261102000003_aih_criticas.sql: críticas da
-- AIH com padrão do produto (bloqueante ou aviso), ajuste do gestor com motivo
-- e histórico, bloqueio na emissão do laudo, críticas e competência do SIGTAP
-- gravadas na AIH, CBO no perfil, alertas de prazo na fila do regulador e
-- laudo sincronizado sem conexão que não é barrado.
BEGIN;
-- banco limpo (CI) não tem a CID-10 carregada; a crítica da AIH confere o CID na tabela
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('J18.9', 'CID do teste J18.9'), ('N40', 'CID do teste N40') ON CONFLICT DO NOTHING;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

-- SIGTAP e CBO de teste, na competência corrente
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303140151', 'Tratamento de pneumonias ou influenza (gripe)', '2', 'I', 0, 1571, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0409030040', 'Ressecção endoscópica de próstata', '2', 'M', 216, 1571, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT (codigo) DO UPDATE SET competencia = EXCLUDED.competencia, sexo = EXCLUDED.sexo;
INSERT INTO terminologia.sigtap_procedimento_cid (procedimento, cid, principal, competencia) VALUES
  ('0303140151', 'J18.9', true, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0409030040', 'N40', true, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;
INSERT INTO terminologia.cbo (codigo, titulo) VALUES ('225125', 'Médico clínico') ON CONFLICT DO NOTHING;

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, raca_cor, nome_mae, endereco, municipio, uf)
VALUES ('23000000-0000-4000-8000-000000000098', '21000000-0000-4000-8000-000000000001', 'Paciente das Críticas da AIH',
        '1960-06-06', 'T-098', '22000000-0000-4000-8000-000000000001', 'F', '898001160012328', 'branca',
        'Mãe das Críticas', 'Rua do Teste, 98', 'São Paulo', 'SP');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em)
VALUES ('25000000-0000-4000-8000-000000000098', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000098',
        '22000000-0000-4000-8000-000000000001', 'atendimento', 'Febre e tosse', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours');
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, episodio_id)
SELECT '24000000-0000-4000-8000-000000000098', u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000098',
       'internado', '22000000-0000-4000-8000-000000000001', now() - interval '1 hour', '25000000-0000-4000-8000-000000000098'
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
UPDATE public.perfis SET cbo = NULL WHERE id = '10000000-0000-4000-8000-000000000002';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'regulador') ON CONFLICT DO NOTHING;
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
CREATE FUNCTION pg_temp.laudo(proc text, diag text) RETURNS text LANGUAGE sql AS $$
  SELECT json_build_object('aih', json_build_object('cid', 'J18.9', 'procCod', proc, 'procDesc', 'Procedimento do teste',
    'sinais', 'Febre e tosse produtiva', 'condicoes', 'Hipoxemia em ar ambiente', 'diagnostico', diag, 'clinica', 'Clínica médica'))::text $$;
GRANT EXECUTE ON FUNCTION pg_temp.laudo(text, text) TO authenticated;
CREATE FUNCTION pg_temp.tem(j jsonb, codigo text) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'codigo' = codigo) $$;
GRANT EXECUTE ON FUNCTION pg_temp.tem(jsonb, text) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. catálogo e padrão do produto ─────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'catalogo', public.criticas_aih_da_unidade('21000000-0000-4000-8000-000000000001')::text;

-- ── 2. conferência do médico: "avisos" como antes, "criticas" com CBO ────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT public.abrir_prontuario('23000000-0000-4000-8000-000000000098', NULL);
INSERT INTO t SELECT 'conf1', public.conferir_aih('23000000-0000-4000-8000-000000000098', 'J18.9', NULL, NULL, '03.03.14.015-1')::text;
SELECT pg_temp.falha($$SELECT public.definir_meu_cbo('999999')$$, 'CBO 999999 não está na lista oficial', 'CBO fora da lista oficial');
SELECT public.definir_meu_cbo('2251-25');
INSERT INTO t SELECT 'conf2', public.conferir_aih('23000000-0000-4000-8000-000000000098', 'J18.9', NULL, NULL, '03.03.14.015-1')::text;

-- ── 3. crítica bloqueante impede o laudo ────────────────────────────────────
-- J18.9 com o procedimento de próstata, em paciente do sexo feminino: CID × procedimento e sexo
SELECT pg_temp.falha(format('SELECT public.emitir_documento(%L, %L, %L)', '23000000-0000-4000-8000-000000000098', 'laudo_aih',
  pg_temp.laudo('0409030040', 'Laudo com procedimento errado')), 'Crítica bloqueante da AIH', 'crítica bloqueante impede emitir o laudo');
SELECT pg_temp.falha(format('SELECT public.definir_critica_aih(%L, %L, false, %L)', '21000000-0000-4000-8000-000000000001', 'sexo',
  'O médico não decide o que bloqueia'), 'As críticas da AIH são configuradas pelo gestor', 'médico não configura críticas');

-- ── 4. o gestor troca para aviso; o laudo sai e a AIH guarda as críticas ─────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.definir_critica_aih(%L, %L, false, %L)', '21000000-0000-4000-8000-000000000001', 'sexo', 'curto'),
  'Escreva o motivo', 'ajuste sem motivo');
SELECT pg_temp.falha(format('SELECT public.definir_critica_aih(%L, %L, true, %L)', '21000000-0000-4000-8000-000000000001', 'sexo',
  'Mantém como está no padrão'), 'A crítica já está como bloqueante', 'ajuste igual ao vigente');
SELECT public.definir_critica_aih('21000000-0000-4000-8000-000000000001', c, false, 'Unidade aceita revisão do regulador para esta crítica')
  FROM unnest(ARRAY['sexo', 'idade', 'cid_procedimento']) c;
INSERT INTO t SELECT 'catalogo2', public.criticas_aih_da_unidade('21000000-0000-4000-8000-000000000001')::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'laudo1', public.emitir_documento('23000000-0000-4000-8000-000000000098', 'laudo_aih',
  pg_temp.laudo('0409030040', 'Laudo com avisos para o regulador')) ->> 'id';
RESET ROLE;
INSERT INTO t SELECT 'aih1', id::text FROM public.aihs WHERE laudo_id = pg_temp.u('laudo1');
-- internado há 80 h: alerta de 72 h na fila do regulador
UPDATE public.internacoes SET data_admissao = now() - interval '80 hours' WHERE id = '24000000-0000-4000-8000-000000000098';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'fila1', public.aihs_da_unidade('21000000-0000-4000-8000-000000000001', 'solicitada')::text;

-- ── 5. competência além de 3 meses da alta: alerta ───────────────────────────
SELECT public.decidir_aih(pg_temp.u('aih1'), true, '3526199900021', NULL, NULL);
RESET ROLE;
UPDATE public.internacoes SET data_alta = now() - interval '5 months' WHERE id = '24000000-0000-4000-8000-000000000098';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
INSERT INTO t SELECT 'fila2', public.aihs_da_unidade('21000000-0000-4000-8000-000000000001', 'aprovada')::text;
SELECT public.cancelar_aih(pg_temp.u('aih1'), 'Cancelada para o teste do laudo sem conexão');

-- ── 6. sem conexão: a crítica bloqueante não barra a sincronização ───────────
RESET ROLE;
SELECT public.definir_critica_aih('21000000-0000-4000-8000-000000000001', 'sexo', true, 'Volta ao padrão do produto para o teste')
  WHERE set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true) IS NOT NULL;
INSERT INTO t SELECT 'off', (private.gravar_documento_episodio(NULL, '23000000-0000-4000-8000-000000000098', 'laudo_aih',
  pg_temp.laudo('0409030040', 'Laudo feito sem conexão'), NULL, NULL, NULL, '10000000-0000-4000-8000-000000000002',
  now() - interval '30 minutes', true, 'aparelho-teste')).id::text;

-- ── 7. SIGTAP desatualizado: aviso ──────────────────────────────────────────
UPDATE terminologia.sigtap_procedimento SET competencia = '202001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
INSERT INTO t SELECT 'conf3', public.conferir_aih('23000000-0000-4000-8000-000000000098', 'J18.9', NULL, NULL, '0303140151')::text;
RESET ROLE;

DO $$
DECLARE v jsonb; x jsonb;
BEGIN
  v := (SELECT valor FROM t WHERE nome = 'catalogo')::jsonb;
  IF jsonb_array_length(v) <> 10
     OR (SELECT (k ->> 'bloqueante')::boolean FROM jsonb_array_elements(v) k WHERE k ->> 'codigo' = 'cns') IS NOT TRUE
     OR (SELECT (k ->> 'bloqueante')::boolean FROM jsonb_array_elements(v) k WHERE k ->> 'codigo' = 'cbo') IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU: catálogo e padrão (%)', v;
  END IF;
  RAISE NOTICE 'OK  catálogo de 10 críticas com o padrão do produto (CNS bloqueia, CBO avisa)';
  v := (SELECT valor FROM t WHERE nome = 'conf1')::jsonb;
  IF jsonb_array_length(v -> 'avisos') <> 0 OR NOT pg_temp.tem(v -> 'criticas', 'cbo') OR v ->> 'competencia' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: conferência sem CBO (%)', v;
  END IF;
  IF pg_temp.tem(((SELECT valor FROM t WHERE nome = 'conf2')::jsonb) -> 'criticas', 'cbo')
     OR (SELECT cbo FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000002') <> '225125' THEN
    RAISE EXCEPTION 'FALHOU: CBO no perfil';
  END IF;
  RAISE NOTICE 'OK  "avisos" como antes; CBO entra nas críticas e sai depois de informado no perfil';
  v := (SELECT valor FROM t WHERE nome = 'catalogo2')::jsonb;
  IF (SELECT (k ->> 'bloqueante')::boolean FROM jsonb_array_elements(v) k WHERE k ->> 'codigo' = 'sexo') IS NOT FALSE
     OR (SELECT k -> 'ajuste' ->> 'motivo' FROM jsonb_array_elements(v) k WHERE k ->> 'codigo' = 'sexo') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: ajuste do gestor (%)', v;
  END IF;
  RAISE NOTICE 'OK  gestor troca para aviso, com motivo e autor';
  x := (SELECT criticas FROM public.aihs WHERE id = pg_temp.u('aih1'));
  IF NOT (pg_temp.tem(x, 'sexo') AND pg_temp.tem(x, 'cid_procedimento'))
     OR (SELECT sigtap_competencia FROM public.aihs WHERE id = pg_temp.u('aih1')) <> to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM') THEN
    RAISE EXCEPTION 'FALHOU: críticas e competência SIGTAP na AIH (%)', x;
  END IF;
  RAISE NOTICE 'OK  a AIH guarda as críticas (avisos) e a competência do SIGTAP';
  v := ((SELECT valor FROM t WHERE nome = 'fila1')::jsonb);
  SELECT e INTO x FROM jsonb_array_elements(v) e WHERE e ->> 'id' = pg_temp.u('aih1')::text;
  IF (x ->> 'alerta_72h')::boolean IS NOT TRUE OR jsonb_array_length(x -> 'criticas') < 2 THEN
    RAISE EXCEPTION 'FALHOU: alerta de 72 h e críticas na fila (%)', x;
  END IF;
  RAISE NOTICE 'OK  fila do regulador: críticas e alerta de 72 h sem decisão';
  SELECT e INTO x FROM jsonb_array_elements((SELECT valor FROM t WHERE nome = 'fila2')::jsonb) e WHERE e ->> 'id' = pg_temp.u('aih1')::text;
  IF (x ->> 'alerta_competencia')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: alerta de competência além de 3 meses da alta (%)', x;
  END IF;
  RAISE NOTICE 'OK  alerta de competência além de 3 meses da alta';
  x := (SELECT a.criticas FROM public.aihs a JOIN public.documentos_clinicos d ON d.id = a.laudo_id WHERE d.id = pg_temp.u('off'));
  IF x IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(x) e WHERE e ->> 'codigo' = 'sexo' AND (e ->> 'bloqueante')::boolean) THEN
    RAISE EXCEPTION 'FALHOU: laudo sem conexão (%)', x;
  END IF;
  RAISE NOTICE 'OK  laudo sincronizado sem conexão não é barrado; a crítica bloqueante fica registrada';
  IF NOT pg_temp.tem(((SELECT valor FROM t WHERE nome = 'conf3')::jsonb) -> 'criticas', 'sigtap_desatualizado') THEN
    RAISE EXCEPTION 'FALHOU: aviso de SIGTAP desatualizado';
  END IF;
  RAISE NOTICE 'OK  aviso de tabela SIGTAP desatualizada';
  IF has_table_privilege('authenticated', 'public.aih_criticas_unidade', 'INSERT')
     OR has_function_privilege('anon', 'public.definir_critica_aih(uuid, text, boolean, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.definir_meu_cbo(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: exposto';
  END IF;
  RAISE NOTICE 'OK  só por RPC; fora do anon';
END $$;
ROLLBACK;
