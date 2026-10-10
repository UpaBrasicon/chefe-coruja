-- Fase 3, tarefa 4 — migration 20261103000004_bpa_c.sql: BPA consolidado.
-- Unidade própria; SIGTAP de teste (instrumento, CBO e quantidade máxima)
-- inserido aqui, porque o banco limpo do CI não tem a tabela carregada.
-- Cobre: destino de cada linha (BPA-I, BPA-C, fora), críticas novas (CBO não
-- aceito, quantidade máxima, sem instrumento de BPA), "sempre BPA-C" da
-- unidade, arquivo único com linhas 02 e 03 (tamanhos, soma por CBO,
-- procedimento e idade, cabeçalho e campo de controle das duas).
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

DELETE FROM terminologia.sigtap_procedimento_registro;
DELETE FROM terminologia.sigtap_procedimento_ocupacao;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, qt_maxima, competencia) VALUES
  ('0301060096', 'ATENDIMENTO MEDICO EM UNIDADE DE PRONTO ATENDIMENTO', '2', 'I', 0, 1571, NULL, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0301060118', 'ACOLHIMENTO COM CLASSIFICAÇÃO DE RISCO', '2', 'I', 0, 1571, 1, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0301100039', 'AFERIÇÃO DE PRESSÃO ARTERIAL', '1', 'I', 0, 1571, NULL, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0101010010', 'ATIVIDADE EDUCATIVA / ORIENTAÇÃO EM GRUPO NA ATENÇÃO PRIMÁRIA', '1', 'I', 0, 1571, NULL, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0303140151', 'TRATAMENTO DE PNEUMONIAS OU INFLUENZA (GRIPE)', '2', 'I', 0, 1571, NULL, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT (codigo) DO UPDATE SET competencia = EXCLUDED.competencia, qt_maxima = EXCLUDED.qt_maxima;
INSERT INTO terminologia.sigtap_procedimento_registro (procedimento, registro, competencia) VALUES
  ('0301060096', '01', '202609'), ('0301060096', '02', '202609'),
  ('0301060118', '01', '202609'), ('0301060118', '02', '202609'),
  ('0301100039', '01', '202609'), ('0301100039', '02', '202609'),
  ('0101010010', '01', '202609'),
  ('0303140151', '03', '202609');
INSERT INTO terminologia.sigtap_procedimento_ocupacao (procedimento, cbo, competencia) VALUES
  ('0301060096', '225125', '202609'),
  ('0301060118', '223505', '202609'),
  ('0301100039', '223505', '202609'),
  ('0101010010', '223505', '202609'),
  ('0303140151', '225125', '202609');

INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT '21000000-0000-4000-8000-000000000096', organizacao_id, 'UPA do teste do BPA-C', tipo, '7654320', 'São Paulo', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000096', '21000000-0000-4000-8000-000000000096', 'PS do BPA-C', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000096', 'faturamento'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000096', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000096', 'enfermeiro');
UPDATE public.perfis SET cns = '796030824628194', cbo = '225125' WHERE id = '10000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET cns = '714852538885393', cbo = '223505' WHERE id = '10000000-0000-4000-8000-000000000004';

-- P1 completo; P2 sem raça/cor e sem documento (não fecha no BPA-I)
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, raca_cor,
                              endereco, cep, municipio_ibge, tipo_logradouro, numero_endereco, bairro, nacionalidade)
VALUES
  ('23000000-0000-4000-8000-000000000961', '21000000-0000-4000-8000-000000000096', 'Paulo Completo', '1980-03-15', 'C-1',
   '22000000-0000-4000-8000-000000000096', 'M', '798682828807290', 'parda', 'Rua A', '01310100', '355030', '081', '10', 'Centro', '010'),
  ('23000000-0000-4000-8000-000000000962', '21000000-0000-4000-8000-000000000096', 'Rita Sem Documento', '1980-06-01', 'C-2',
   '22000000-0000-4000-8000-000000000096', 'F', NULL, 'sem_informacao', NULL, NULL, NULL, NULL, NULL, NULL, NULL);

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t VALUES
  ('comp', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM')),
  ('dia10', ((date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month') + interval '9 days 12 hours')
             AT TIME ZONE 'America/Sao_Paulo')::text);
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
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
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;

INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em,
                              atendimento_medico_id, atendimento_iniciado_em)
SELECT ('25000000-0000-4000-8000-00000000096' || n)::uuid, '21000000-0000-4000-8000-000000000096',
       ('23000000-0000-4000-8000-00000000096' || n)::uuid, '22000000-0000-4000-8000-000000000096', 'atendimento', 'Dor',
       '10000000-0000-4000-8000-000000000004', pg_temp.v('dia10')::timestamptz - interval '1 hour',
       '10000000-0000-4000-8000-000000000002', pg_temp.v('dia10')::timestamptz
  FROM generate_series(1, 2) n;
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, criado_em)
SELECT ('25000000-0000-4000-8000-00000000096' || n)::uuid, '21000000-0000-4000-8000-000000000096',
       ('23000000-0000-4000-8000-00000000096' || n)::uuid, 'verde', 'adulto', '10000000-0000-4000-8000-000000000004',
       'enfermeiro', pg_temp.v('dia10')::timestamptz - interval '50 minutes'
  FROM generate_series(1, 2) n;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.definir_bpa_config('21000000-0000-4000-8000-000000000096', jsonb_build_object(
  'orgao_origem', 'UPA BPA-C', 'sigla', 'UPAC', 'cnpj', '11222333000181', 'orgao_destino', 'SMS Teste', 'destino', 'M', 'carater_atendimento', '02'));
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000096', '0301060096', 'atendimento_medico');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000096', '0301060118', 'classificacao');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000096', '0301100039', 'lista');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000096', '0101010010', 'lista');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000096', '0301060118', 'lista');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000096', '0303140151', 'lista');

-- registros: PA pelo médico (CBO não aceito), educativa (só BPA-C), acolhimento x2 (acima do máximo), AIH-only (sem BPA)
SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000961', '0301100039', 1, NULL, pg_temp.v('dia10')::timestamptz, '10000000-0000-4000-8000-000000000002');
SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000961', '0101010010', 3, NULL, pg_temp.v('dia10')::timestamptz, '10000000-0000-4000-8000-000000000004');
SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000961', '0301060118', 2, NULL, pg_temp.v('dia10')::timestamptz, '10000000-0000-4000-8000-000000000004');
SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000961', '0303140151', 1, NULL, pg_temp.v('dia10')::timestamptz, '10000000-0000-4000-8000-000000000002');

-- ── 1. destino de cada linha ────────────────────────────────────────────────
INSERT INTO t SELECT 'conf', public.bpa_conferencia('21000000-0000-4000-8000-000000000096', pg_temp.v('comp'))::text;
-- P1: atendimento e classificação em BPA-I; educativa em BPA-C (SIGTAP só aceita BPA-C)
-- P2: atendimento e classificação em BPA-C (sem raça e sem documento)
-- fora: PA (CBO não aceito), acolhimento x2 (máximo 1), pneumonia (sem BPA)
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb ->> 'total')::int = 8, 'conferência: 8 linhas');
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb ->> 'bpa_i')::int = 2, '2 linhas em BPA-I');
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb ->> 'bpa_c')::int = 3, '3 linhas em BPA-C (só BPA-C no SIGTAP e paciente sem identificação)');
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb ->> 'com_critica')::int = 3, '3 linhas fora');
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb -> 'por_critica' ->> 'cbo_nao_aceito')::int = 1
               AND (pg_temp.v('conf')::jsonb -> 'por_critica' ->> 'quantidade_maxima')::int = 1
               AND (pg_temp.v('conf')::jsonb -> 'por_critica' ->> 'instrumento')::int = 1,
  'críticas novas: CBO não aceito, quantidade máxima, sem instrumento de BPA');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('conf')::jsonb -> 'linhas') x
                           WHERE x->>'destino' = 'bpa_c' AND x->>'paciente' = 'Rita Sem Documento' AND x->>'motivo_c' LIKE 'Não fecha no BPA-I%'),
  'BPA-C mostra o motivo');

-- ── 2. "sempre BPA-C" da unidade ────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.marcar_sempre_bpa_c((SELECT id FROM public.bpa_procedimentos_unidade
  WHERE unidade_id = '21000000-0000-4000-8000-000000000096' AND procedimento = '0303140151' AND vigente_ate IS NULL), true)$$,
  'O SIGTAP não aceita este procedimento em BPA consolidado', 'sempre BPA-C só em código que aceita BPA-C');
SELECT public.marcar_sempre_bpa_c((SELECT id FROM public.bpa_procedimentos_unidade
  WHERE unidade_id = '21000000-0000-4000-8000-000000000096' AND uso = 'atendimento_medico' AND vigente_ate IS NULL), true);
INSERT INTO t SELECT 'conf2', public.bpa_conferencia('21000000-0000-4000-8000-000000000096', pg_temp.v('comp'))::text;
SELECT pg_temp.ok((pg_temp.v('conf2')::jsonb ->> 'bpa_i')::int = 1 AND (pg_temp.v('conf2')::jsonb ->> 'bpa_c')::int = 4,
  'atendimento médico marcado vai todo para o BPA-C');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.marcar_sempre_bpa_c((SELECT id FROM public.bpa_procedimentos_unidade
  WHERE unidade_id = '21000000-0000-4000-8000-000000000096' AND uso = 'classificacao' AND vigente_ate IS NULL), true)$$,
  'BPA da unidade: faturamento ou gestor', 'médico não marca sempre BPA-C');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');

-- ── 3. arquivo único ────────────────────────────────────────────────────────
INSERT INTO t SELECT 'fech', public.fechar_competencia_bpa('21000000-0000-4000-8000-000000000096', pg_temp.v('comp'))::text;
INSERT INTO t SELECT 'arq', public.arquivo_bpa(pg_temp.v('fech')::uuid) ->> 'conteudo';
CREATE TEMP VIEW linhas_arq AS
  SELECT n, l FROM unnest(string_to_array(pg_temp.v('arq'), E'\r\n')) WITH ORDINALITY AS x(l, n) WHERE l <> '';
GRANT SELECT ON linhas_arq TO authenticated;
-- BPA-C: atendimento P1+P2 (225125, mesma idade 46: soma 2), classificação P2 (223505), educativa P1 (223505, qt 3)
SELECT pg_temp.ok((SELECT count(*) FROM linhas_arq WHERE left(l, 2) = '02') = 3
               AND (SELECT count(*) FROM linhas_arq WHERE left(l, 2) = '03') = 1,
  'arquivo: 3 linhas de BPA-C e 1 de BPA-I');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM linhas_arq WHERE left(l, 2) = '02' AND length(l) <> 48)
               AND NOT EXISTS (SELECT 1 FROM linhas_arq WHERE left(l, 2) = '03' AND length(l) <> 351),
  'tamanhos: BPA-C 50 e BPA-I 353 com CR+LF');
SELECT pg_temp.ok((SELECT substr(l, 37, 3) || substr(l, 40, 6) FROM linhas_arq WHERE left(l, 2) = '02' AND substr(l, 27, 10) = '0301060096')
                  = lpad(extract(year FROM age((pg_temp.v('dia10')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date, date '1980-06-01'))::text, 3, '0') || '000002'
               AND (SELECT substr(l, 16, 6) FROM linhas_arq WHERE left(l, 2) = '02' AND substr(l, 27, 10) = '0101010010') = '223505'
               AND (SELECT substr(l, 40, 6) FROM linhas_arq WHERE left(l, 2) = '02' AND substr(l, 27, 10) = '0101010010') = '000003'
               AND (SELECT bool_and(substr(l, 3, 7) = '7654320' AND substr(l, 10, 6) = pg_temp.v('comp') AND substr(l, 46, 3) = 'BPA')
                      FROM linhas_arq WHERE left(l, 2) = '02'),
  'BPA-C soma por CBO, procedimento e idade; CNES, competência e origem');
SELECT pg_temp.ok((SELECT substr(l, 14, 6) || substr(l, 20, 6) FROM linhas_arq WHERE n = 1) = '000004000002'
               AND (SELECT substr(l, 26, 4) FROM linhas_arq WHERE n = 1)
                   = ((SELECT sum(CASE WHEN left(l, 2) = '02' THEN substr(l, 27, 10)::bigint + substr(l, 40, 6)::bigint
                                       ELSE substr(l, 50, 10)::bigint + substr(l, 89, 6)::bigint END)
                         FROM linhas_arq WHERE n > 1) % 1111 + 1111)::text,
  'cabeçalho conta as duas (4 linhas, 2 folhas) e o controle soma as duas');
SELECT pg_temp.ok((SELECT linhas_bpa_c = 3 AND jsonb_array_length(excluidas) = 3 FROM public.bpa_fechamentos WHERE id = pg_temp.v('fech')::uuid),
  'fechamento guarda as linhas de BPA-C e as excluídas');

ROLLBACK;
