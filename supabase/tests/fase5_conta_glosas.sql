-- Testes da migration 20261204000001_conta_glosas.sql (Fase 5B, tarefa 6):
-- glosa de item ou da conta inteira, só em conta fechada; valor do SIGTAP;
-- motivo da lista; recurso, recuperação e perda (só o gestor); painel.
-- ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'faturamento') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp)
VALUES ('0204030153', 'RADIOGRAFIA DE TORAX TESTE', '2', 'I', 0, 1560, to_char(private.data_atual(), 'YYYYMM'), 10.50, 0, 0)
ON CONFLICT (codigo) DO UPDATE SET valor_sa = 10.50;
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo) VALUES
  ('23000000-0000-4000-8000-0000000d6201', '21000000-0000-4000-8000-000000000001', 'Paciente Glosa', '1975-03-03', 'GL-1',
   '22000000-0000-4000-8000-000000000003', 'M');
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_medico_id, atendimento_iniciado_em)
VALUES ('25000000-0000-4000-8000-0000000d6201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d6201',
        '22000000-0000-4000-8000-000000000003', 'atendimento', 'Trauma', '10000000-0000-4000-8000-000000000004', now() - interval '3 hours',
        '10000000-0000-4000-8000-000000000002', now() - interval '150 minutes');
INSERT INTO public.apacs (id, unidade_id, paciente_id, episodio_id, tipo, procedimento, cid_principal, carater, status, numero,
                         validade_inicio, validade_fim, solicitada_por)
VALUES ('2c000000-0000-4000-8000-0000000d6201', '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-0000000d6201',
        '25000000-0000-4000-8000-0000000d6201', '1', '0204030153', 'S52.5', '02', 'autorizada', '3526100000099',
        private.data_atual() - 5, private.data_atual() + 85, '10000000-0000-4000-8000-000000000002');

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
INSERT INTO t SELECT 'conta', id::text FROM public.contas WHERE episodio_id = '25000000-0000-4000-8000-0000000d6201';
INSERT INTO t VALUES ('apac', '2c000000-0000-4000-8000-0000000d6201'), ('comp', to_char(private.data_atual(), 'YYYYMM')),
                     ('depois', to_char(private.data_atual() + interval '1 month', 'YYYYMM')), ('antes', to_char(private.data_atual() - interval '2 months', 'YYYYMM'));

-- 6a. só em conta fechada ou faturada
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.registrar_glosa(%L, NULL, NULL, %L)', pg_temp.u('conta'), 'cns'),
  'Glosa só entra em conta fechada ou faturada', 'conta aberta não recebe glosa');
RESET ROLE;
UPDATE public.episodios SET etapa = 'encerrado', desfecho = 'alta', desfecho_em = now() - interval '1 hour',
       desfecho_por = '10000000-0000-4000-8000-000000000002', encerrado_em = now() - interval '1 hour'
 WHERE id = '25000000-0000-4000-8000-0000000d6201';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('conta'), 'em_conferencia');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.liberar_fechamento_conta(pg_temp.u('conta'), 'unidade de teste sem CNES nem códigos');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('conta'), 'fechada');

-- 2a/3a. o que pode ser glosado, com o valor de referência
DO $$
DECLARE g jsonb := public.conta_detalhe(pg_temp.u('conta')) -> 'glosaveis'; a jsonb;
BEGIN
  IF g -> 0 ->> 'rotulo' <> 'Conta inteira' OR g -> 0 ->> 'origem' IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: conta inteira: %', g -> 0; END IF;
  SELECT x INTO a FROM jsonb_array_elements(g) x WHERE x ->> 'origem' = 'apac';
  IF (a ->> 'valor')::numeric <> 10.50 OR a ->> 'rotulo' NOT LIKE 'APAC 3526100000099%' THEN RAISE EXCEPTION 'FALHOU: APAC glosável: %', a; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g) x WHERE x ->> 'origem' = 'atendimento') THEN RAISE EXCEPTION 'FALHOU: linha do BPA glosável'; END IF;
  RAISE NOTICE 'OK  2a/3a: conta inteira, linhas da conta e APAC ligada, com o valor do SIGTAP';
END $$;

-- 4a. motivo
SELECT pg_temp.falha(format('SELECT public.registrar_glosa(%L, %L, %L, %L)', pg_temp.u('conta'), 'apac', pg_temp.u('apac'), 'qualquer'),
  'Escolha o motivo', 'motivo fora da lista');
SELECT pg_temp.falha(format('SELECT public.registrar_glosa(%L, NULL, NULL, %L, %L)', pg_temp.u('conta'), 'outro', 'curto'),
  'Motivo "outro": descreva', '"outro" pede texto');
SELECT pg_temp.falha(format('SELECT public.registrar_glosa(%L, %L, %L, %L)', pg_temp.u('conta'), 'apac', gen_random_uuid(), 'documento'),
  'Item não encontrado nesta conta', 'item de fora da conta');
-- 1a/3a. APAC sem valor informado: vem o do SIGTAP
INSERT INTO t SELECT 'g1', public.registrar_glosa(pg_temp.u('conta'), 'apac', pg_temp.u('apac'), 'documento', 'APAC vencida no processamento') ->> 'id';
SELECT pg_temp.falha(format('SELECT public.registrar_glosa(%L, %L, %L, %L)', pg_temp.u('conta'), 'apac', pg_temp.u('apac'), 'cid'),
  'Já há glosa em andamento para este item', 'uma glosa em andamento por item');
-- conta inteira, com valor informado
INSERT INTO t SELECT 'g2', public.registrar_glosa(pg_temp.u('conta'), NULL, NULL, 'outro', 'produção do mês recusada pelo gestor municipal', 5, (SELECT v FROM t WHERE k = 'comp')) ->> 'id';
RESET ROLE;
DO $$
DECLARE a public.conta_glosas;
BEGIN
  SELECT * INTO a FROM public.conta_glosas WHERE id = pg_temp.u('g1');
  IF a.valor <> 10.50 OR a.valor_sugerido <> 10.50 OR a.status <> 'aberta' OR a.motivo_codigo <> 'documento' THEN RAISE EXCEPTION 'FALHOU: glosa da APAC: %', a; END IF;
  SELECT * INTO a FROM public.conta_glosas WHERE id = pg_temp.u('g2');
  IF a.valor <> 5 OR a.item_id IS NOT NULL OR a.item_rotulo <> 'Conta inteira' THEN RAISE EXCEPTION 'FALHOU: glosa da conta inteira: %', a; END IF;
  RAISE NOTICE 'OK  1a/3a/4a: registro à mão; valor do SIGTAP ou informado; motivo da lista com texto';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha(format('SELECT public.registrar_glosa(%L, %L, %L, %L)', pg_temp.u('conta'), 'atendimento', gen_random_uuid(), 'cns'),
  'Acesso negado: quem registra glosa é o faturamento', 'gestor não registra');

-- 5a. recurso, recurso negado, recuperação parcial
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha(format('SELECT public.mudar_glosa(%L, %L, %L)', pg_temp.u('g1'), 'em_recurso', 'curto'),
  'Escreva o motivo deste passo', 'cada passo pede motivo');
SELECT pg_temp.falha(format('SELECT public.mudar_glosa(%L, %L, %L)', pg_temp.u('g1'), 'em_recurso', 'APAC renovada e reapresentada'),
  'Diga a competência', 'recurso pede a competência');
SELECT pg_temp.falha(format('SELECT public.mudar_glosa(%L, %L, %L, %L)', pg_temp.u('g1'), 'em_recurso', 'APAC renovada e reapresentada', (SELECT v FROM t WHERE k = 'antes')),
  'A competência do recurso não pode ser anterior', 'competência do recurso não volta no tempo');
SELECT public.mudar_glosa(pg_temp.u('g1'), 'em_recurso', 'APAC renovada e reapresentada', (SELECT v FROM t WHERE k = 'depois'));
SELECT public.mudar_glosa(pg_temp.u('g1'), 'aberta', 'reapresentação recusada de novo');
SELECT public.mudar_glosa(pg_temp.u('g1'), 'em_recurso', 'recurso com a autorização nova', (SELECT v FROM t WHERE k = 'depois'));
SELECT pg_temp.falha(format('SELECT public.mudar_glosa(%L, %L, %L, NULL, 99)', pg_temp.u('g1'), 'recuperada', 'pago na competência seguinte'),
  'Valor recuperado entre zero e o valor glosado', 'não recupera mais do que glosou');
SELECT public.mudar_glosa(pg_temp.u('g1'), 'recuperada', 'pago na competência seguinte', NULL, 8);
-- 6a. só o gestor marca como perdida
SELECT pg_temp.falha(format('SELECT public.mudar_glosa(%L, %L, %L)', pg_temp.u('g2'), 'perdida', 'prazo de recurso vencido'),
  'Só o gestor marca a glosa como perdida', 'perdida é do gestor');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.mudar_glosa(pg_temp.u('g2'), 'perdida', 'prazo de recurso vencido');
SELECT pg_temp.falha(format('SELECT public.mudar_glosa(%L, %L, %L)', pg_temp.u('g1'), 'perdida', 'tentando perder a recuperada'),
  'Mudança não permitida: de recuperada para perdida', 'recuperada é final');
RESET ROLE;
DO $$
DECLARE a public.conta_glosas; d jsonb := public.conta_detalhe(pg_temp.u('conta')); p jsonb;
BEGIN
  SELECT * INTO a FROM public.conta_glosas WHERE id = pg_temp.u('g1');
  IF a.status <> 'recuperada' OR a.valor_recuperado <> 8 OR a.competencia_recurso IS NULL THEN RAISE EXCEPTION 'FALHOU: glosa recuperada: %', a; END IF;
  IF (SELECT string_agg(evento, ',' ORDER BY em, id) FROM public.conta_glosa_eventos WHERE glosa_id = a.id) IS NULL
     OR (SELECT count(*) FROM public.conta_glosa_eventos WHERE glosa_id = a.id) <> 5 THEN
    RAISE EXCEPTION 'FALHOU: histórico da glosa';
  END IF;
  IF d ->> 'status' <> 'fechada' OR jsonb_array_length(d -> 'glosas') <> 2 THEN RAISE EXCEPTION 'FALHOU: conta com glosas: %', d ->> 'status'; END IF;
  RAISE NOTICE 'OK  5a/6a: recurso, recurso negado, recuperação parcial e perda pelo gestor; a conta não muda de etapa';
  p := public.glosas_da_unidade('21000000-0000-4000-8000-000000000001');
  IF (p -> 'totais' ->> 'glosado')::numeric <> 15.50 OR (p -> 'totais' ->> 'recuperado')::numeric <> 8
     OR (p -> 'totais' ->> 'perdido')::numeric <> 5 OR jsonb_array_length(p -> 'por_motivo') <> 2
     OR NOT (p ->> 'pode_perder')::boolean THEN
    RAISE EXCEPTION 'FALHOU: painel: %', p - 'glosas';
  END IF;
  RAISE NOTICE 'OK  6a: painel com glosado, recuperado e perdido, por competência e por motivo';
END $$;
-- depois de recuperada, o item pode receber outra glosa
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.registrar_glosa(pg_temp.u('conta'), 'apac', pg_temp.u('apac'), 'quantidade', NULL, 2);
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'public.conta_glosas', 'INSERT') OR has_table_privilege('authenticated', 'public.conta_glosa_eventos', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.conta_glosas', 'SELECT')
     OR has_function_privilege('anon', 'public.registrar_glosa(uuid, text, uuid, text, text, numeric, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.glosaveis_da_conta(public.contas)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: privilégios';
  END IF;
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade_id = pg_temp.u('g1') AND acao LIKE 'glosa_%') <> 5 THEN
    RAISE EXCEPTION 'FALHOU: auditoria da glosa';
  END IF;
  RAISE NOTICE 'OK  tabelas só pelas funções; auditoria de cada passo; item recuperado aceita glosa nova';
END $$;
ROLLBACK;
