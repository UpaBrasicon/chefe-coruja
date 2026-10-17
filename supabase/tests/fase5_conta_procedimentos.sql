-- Testes da migration 20261128000001_conta_procedimentos.sql (Fase 5B, tarefa 2):
-- a conta da porta lê as linhas do BPA do atendimento; a de internação, a AIH e
-- os especiais lançados; valor de referência do SIGTAP; lançar/retirar com
-- motivo; a lista congela ao fechar e volta a acompanhar ao reabrir. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
DELETE FROM terminologia.sigtap_procedimento_registro;
DELETE FROM terminologia.sigtap_procedimento_ocupacao;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia, valor_sa, valor_sh, valor_sp, qt_maxima) VALUES
  ('0301060096', 'ATENDIMENTO MEDICO EM UPA', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), 11.00, 0, 0, NULL),
  ('0301060118', 'ACOLHIMENTO COM CLASSIFICAÇÃO DE RISCO', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), 1.00, 0, 0, NULL),
  ('0301100039', 'AFERIÇÃO DE PRESSÃO ARTERIAL', '1', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), 0.50, 0, 0, NULL),
  ('0303140151', 'TRATAMENTO DE PNEUMONIA TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), 0, 400.00, 100.00, NULL),
  ('0802010999', 'DIÁRIA DE UTI TESTE', '3', 'F', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), 0, 300.00, 50.00, 5)
ON CONFLICT (codigo) DO UPDATE SET valor_sa = EXCLUDED.valor_sa, valor_sh = EXCLUDED.valor_sh, valor_sp = EXCLUDED.valor_sp,
  sexo = EXCLUDED.sexo, qt_maxima = EXCLUDED.qt_maxima, competencia = EXCLUDED.competencia;

INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT '21000000-0000-4000-8000-000000000096', organizacao_id, 'UPA do teste da conta', tipo, '7654322', 'São Paulo', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000096', 'PS da conta', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000096', 'faturamento'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000096', 'gestor'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000096', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000096', 'enfermeiro');
UPDATE public.perfis SET cns = '796030824628194', cbo = '225125' WHERE id = '10000000-0000-4000-8000-000000000002';
INSERT INTO public.bpa_procedimentos_unidade (unidade_id, procedimento, uso, definido_por) VALUES
  ('21000000-0000-4000-8000-000000000096', '0301060096', 'atendimento_medico', '10000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000096', '0301060118', 'classificacao', '10000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000096', '0301100039', 'lista', '10000000-0000-4000-8000-000000000001');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns) VALUES
  ('23000000-0000-4000-8000-000000000961', '21000000-0000-4000-8000-000000000096', 'Paciente Da Conta', '1980-03-15', 'C-1',
   '22000000-0000-4000-8000-000000000096', 'M', '798682828807290');
-- atendimento na porta, com médico e classificação
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em, atendimento_medico_id, atendimento_iniciado_em)
VALUES ('25000000-0000-4000-8000-000000000961', '21000000-0000-4000-8000-000000000096', '23000000-0000-4000-8000-000000000961',
        '22000000-0000-4000-8000-000000000096', 'atendimento', 'Febre e tosse', '10000000-0000-4000-8000-000000000004',
        now() - interval '3 hours', '10000000-0000-4000-8000-000000000002', now() - interval '2 hours');
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, criado_em, reclassificacao)
VALUES ('25000000-0000-4000-8000-000000000961', '21000000-0000-4000-8000-000000000096', '23000000-0000-4000-8000-000000000961',
        'amarelo', 'adulto', '10000000-0000-4000-8000-000000000004', 'enfermeiro', now() - interval '170 minutes', false);

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
INSERT INTO t SELECT 'porta', id::text FROM public.contas WHERE episodio_id = '25000000-0000-4000-8000-000000000961';

-- 1a/5a. a conta da porta lê as linhas do BPA do atendimento, com o valor SA
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('porta'));
BEGIN
  IF (SELECT string_agg(x ->> 'procedimento', ',' ORDER BY x ->> 'procedimento') FROM jsonb_array_elements(d -> 'itens') x) <> '0301060096,0301060118'
     OR (d ->> 'total_referencia')::numeric <> 12.00 THEN
    RAISE EXCEPTION 'FALHOU: itens da porta: % total %', d -> 'itens', d -> 'total_referencia';
  END IF;
  RAISE NOTICE 'OK  1a/5a: consulta e classificação do BPA na conta da porta, total de referência SA';
END $$;
-- 4a. lançar na porta = o mesmo lançamento do BPA
INSERT INTO t SELECT 'pa', x ->> 'origem_id' FROM jsonb_array_elements(
  public.lancar_procedimento_conta(pg_temp.u('porta'), '0301100039', 2, '10000000-0000-4000-8000-000000000002') -> 'itens') x
  WHERE x ->> 'procedimento' = '0301100039';
SELECT pg_temp.falha(format('SELECT public.retirar_procedimento_conta(%L, %L, %L, %L)', pg_temp.u('porta'), 'atendimento',
  pg_temp.u('pa'), 'não houve consulta nenhuma'), 'Este item vem do atendimento', 'item do atendimento não se retira na conta');
SELECT pg_temp.falha(format('SELECT public.retirar_procedimento_conta(%L, %L, %L, %L)', pg_temp.u('porta'), 'registro', pg_temp.u('pa'), 'curto'),
  'Escreva o motivo', 'retirar pede motivo');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.procedimentos_realizados WHERE id = pg_temp.u('pa') AND episodio_id = '25000000-0000-4000-8000-000000000961'
                  AND quantidade = 2 AND via = 'faturamento') THEN
    RAISE EXCEPTION 'FALHOU: lançamento da porta deveria ir para o BPA (procedimentos_realizados)';
  END IF;
  RAISE NOTICE 'OK  4a: lançamento na conta da porta entra no BPA (conta e BPA não divergem)';
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.retirar_procedimento_conta(pg_temp.u('porta'), 'registro', pg_temp.u('pa'), 'lançado em dobro por engano');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.conta_detalhe(pg_temp.u('porta')) -> 'itens') x WHERE x ->> 'procedimento' = '0301100039') THEN
    RAISE EXCEPTION 'FALHOU: retirada não saiu da conta';
  END IF;
  RAISE NOTICE 'OK  4a: retirada com motivo sai da conta (e do BPA)';
END $$;
RESET ROLE;

-- 3a. internação (admissão direta, sem atendimento de porta): procedimento principal da AIH e especial lançado
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao, internado_em, episodio_id)
SELECT '26000000-0000-4000-8000-000000000961', organizacao_id, '21000000-0000-4000-8000-000000000096', '23000000-0000-4000-8000-000000000961',
       'internado', '22000000-0000-4000-8000-000000000096', now() - interval '1 hour', now() - interval '1 hour', NULL
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000096';
INSERT INTO t SELECT 'int', id::text FROM public.contas WHERE internacao_id = '26000000-0000-4000-8000-000000000961';
INSERT INTO public.documentos_clinicos (id, documento_raiz_id, organizacao_id, unidade_id, paciente_id, tipo_documento, conteudo, conteudo_hash, autor_id)
SELECT '27000000-0000-4000-8000-000000000961', '27000000-0000-4000-8000-000000000961', organizacao_id, '21000000-0000-4000-8000-000000000096',
       '23000000-0000-4000-8000-000000000961', 'atestado', '{"aih":{"procCod":"03.03.14.015-1","cid":"J18.9"}}', 'teste',
       '10000000-0000-4000-8000-000000000002'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000096';
INSERT INTO public.aihs (unidade_id, paciente_id, internacao_id, laudo_raiz_id, laudo_id, solicitada_por, criticas)
VALUES ('21000000-0000-4000-8000-000000000096', '23000000-0000-4000-8000-000000000961', '26000000-0000-4000-8000-000000000961',
        '27000000-0000-4000-8000-000000000961', '27000000-0000-4000-8000-000000000961', '10000000-0000-4000-8000-000000000002', '[]');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.lancar_procedimento_conta(pg_temp.u('int'), '0802010999', 7, '10000000-0000-4000-8000-000000000002');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('int')); uti jsonb;
BEGIN
  SELECT x INTO uti FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'procedimento' = '0802010999';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d -> 'itens') x WHERE x ->> 'origem' = 'aih' AND x ->> 'procedimento' = '0303140151'
                  AND (x ->> 'valor_total')::numeric = 500.00) THEN
    RAISE EXCEPTION 'FALHOU: procedimento principal da AIH: %', d -> 'itens';
  END IF;
  IF (uti ->> 'valor_total')::numeric <> 2450.00
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(uti -> 'criticas') x WHERE x ->> 'codigo' = 'quantidade_maxima')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(uti -> 'criticas') x WHERE x ->> 'codigo' = 'sexo')
     OR (d ->> 'itens_com_aviso')::int < 1 OR (d ->> 'total_referencia')::numeric <> 2950.00 THEN
    RAISE EXCEPTION 'FALHOU: especial da internação: % / %', uti, d ->> 'total_referencia';
  END IF;
  RAISE NOTICE 'OK  3a/5a/6a: AIH principal (SH+SP) e especial lançado, com avisos de quantidade e sexo, sem travar';
END $$;

-- 2a. fecha congelada; mudança depois não altera a conta fechada; reabrir volta a acompanhar
RESET ROLE;
UPDATE public.internacoes SET data_alta = now(), status = 'alta_melhorada' WHERE id = '26000000-0000-4000-8000-000000000961';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('int'), 'em_conferencia');
-- Fase 5B, tarefa 5: a conta de teste tem pendência bloqueante; o gestor libera
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.liberar_fechamento_conta(pg_temp.u('int'), 'liberado no teste da tarefa anterior');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.mudar_etapa_conta(pg_temp.u('int'), 'fechada');
SELECT pg_temp.falha(format('SELECT public.lancar_procedimento_conta(%L, %L)', pg_temp.u('int'), '0802010999'),
  'Conta fechada: o gestor reabre', 'conta fechada não recebe lançamento');
RESET ROLE;
UPDATE public.conta_lancamentos SET quantidade = 1 WHERE conta_id = pg_temp.u('int');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('int'));
BEGIN
  IF d ->> 'congelada_em' IS NULL OR (d ->> 'total_referencia')::numeric <> 2950.00 THEN
    RAISE EXCEPTION 'FALHOU: conta fechada deveria manter a lista do fechamento (%)', d ->> 'total_referencia';
  END IF;
  RAISE NOTICE 'OK  2a: conta fechada mostra a lista congelada no fechamento';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.mudar_etapa_conta(pg_temp.u('int'), 'aberta', 'refazer a conferência da UTI');
DO $$
DECLARE d jsonb := public.conta_detalhe(pg_temp.u('int'));
BEGIN
  IF d ->> 'congelada_em' IS NOT NULL OR (d ->> 'total_referencia')::numeric <> 850.00 THEN
    RAISE EXCEPTION 'FALHOU: reaberta deveria voltar a acompanhar (%)', d ->> 'total_referencia';
  END IF;
  RAISE NOTICE 'OK  2a: reaberta, a conta volta a acompanhar';
END $$;
SELECT pg_temp.falha(format('SELECT public.lancar_procedimento_conta(%L, %L)', pg_temp.u('int'), '0802010999'),
  'Acesso negado: o lançamento na conta é do faturamento', 'gestor não lança');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.conta_eventos WHERE conta_id IN (pg_temp.u('porta'), pg_temp.u('int')) AND evento IN ('lancamento', 'retirada')) <> 3 THEN
    RAISE EXCEPTION 'FALHOU: lançamentos e retiradas no histórico';
  END IF;
  IF has_table_privilege('authenticated', 'public.conta_lancamentos', 'INSERT') THEN RAISE EXCEPTION 'FALHOU: lançamento gravável por fora'; END IF;
  RAISE NOTICE 'OK  lançamentos e retiradas no histórico; tabela só pelas funções';
END $$;
ROLLBACK;
