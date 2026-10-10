-- Fase 3, tarefa 3 — migration 20261103000002_bpa_i.sql: BPA individualizado.
-- Unidade própria do teste (contagens exatas). Cobre o papel faturamento, a
-- configuração do cabeçalho e dos códigos, as quatro fontes (atendimento
-- médico, primeira classificação, medicação somada por dia, registro), as
-- críticas e avisos, o arquivo no leiaute 05.00 (tamanhos, posições, campo de
-- controle, CNS ou CPF), o fechamento que trava o registro e a reabertura com
-- motivo, o CNS do perfil e o endereço do SUS.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
-- regras do BPA-I puro: sem instrumento/CBO do SIGTAP carregados (o BPA-C tem teste próprio)
DELETE FROM terminologia.sigtap_procedimento_registro;
DELETE FROM terminologia.sigtap_procedimento_ocupacao;

INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0301060096', 'ATENDIMENTO MEDICO EM UNIDADE DE PRONTO ATENDIMENTO', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0301060118', 'ACOLHIMENTO COM CLASSIFICAÇÃO DE RISCO', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0301100012', 'ADMINISTRACAO DE MEDICAMENTOS NA ATENCAO ESPECIALIZADA.', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0301100039', 'AFERIÇÃO DE PRESSÃO ARTERIAL', '1', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT (codigo) DO UPDATE SET competencia = EXCLUDED.competencia;
INSERT INTO terminologia.cbo (codigo, titulo) VALUES ('225125', 'Médico clínico'), ('223505', 'Enfermeiro') ON CONFLICT DO NOTHING;

-- unidade do teste
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT '21000000-0000-4000-8000-000000000097', organizacao_id, 'UPA do teste do BPA', tipo, '7654321', 'São Paulo', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000097', '21000000-0000-4000-8000-000000000097', 'PS do BPA', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000097', 'faturamento'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000097', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000097', 'enfermeiro');
UPDATE public.perfis SET cns = '796030824628194', cbo = '225125' WHERE id = '10000000-0000-4000-8000-000000000002';
UPDATE public.perfis SET cns = '714852538885393', cbo = '223505' WHERE id = '10000000-0000-4000-8000-000000000004';

-- P1 completo (CNS); P2 sem raça, sem endereço e sem documento; P3 com CPF só
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, cpf, raca_cor,
                              endereco, cep, municipio_ibge, tipo_logradouro, numero_endereco, bairro, nacionalidade, telefone)
VALUES
  ('23000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000097', 'José da Conferência Ávila', '1980-03-15', 'B-1',
   '22000000-0000-4000-8000-000000000097', 'M', '798682828807290', NULL, 'parda',
   'Rua das Flores', '01310100', '355030', '081', '120', 'Centro', '010', '(11) 98765-4321'),
  ('23000000-0000-4000-8000-000000000972', '21000000-0000-4000-8000-000000000097', 'Maria Sem Dados', '1990-01-01', 'B-2',
   '22000000-0000-4000-8000-000000000097', 'F', NULL, NULL, 'sem_informacao',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('23000000-0000-4000-8000-000000000973', '21000000-0000-4000-8000-000000000097', 'Ana do CPF', '2015-07-20', 'B-3',
   '22000000-0000-4000-8000-000000000097', 'F', NULL, '52998224725', 'branca',
   'Av Brasil', '20040002', '330455', '008', 'SN', 'Gamboa', '010', NULL);

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

-- atendimentos do mês anterior (dia 10, meio-dia de Brasília)
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em,
                              atendimento_medico_id, atendimento_iniciado_em)
SELECT ('25000000-0000-4000-8000-00000000097' || n)::uuid, '21000000-0000-4000-8000-000000000097',
       ('23000000-0000-4000-8000-00000000097' || n)::uuid, '22000000-0000-4000-8000-000000000097', 'atendimento', 'Dor',
       '10000000-0000-4000-8000-000000000004', pg_temp.v('dia10')::timestamptz - interval '1 hour',
       '10000000-0000-4000-8000-000000000002', pg_temp.v('dia10')::timestamptz
  FROM generate_series(1, 3) n;
-- classificação: só a primeira do episódio conta (a reclassificação não)
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, criado_em, reclassificacao)
SELECT ('25000000-0000-4000-8000-00000000097' || n)::uuid, '21000000-0000-4000-8000-000000000097',
       ('23000000-0000-4000-8000-00000000097' || n)::uuid, 'verde', 'adulto', '10000000-0000-4000-8000-000000000004',
       'enfermeiro', pg_temp.v('dia10')::timestamptz - interval '50 minutes', false
  FROM generate_series(1, 3) n;
INSERT INTO public.classificacoes_risco (episodio_id, unidade_id, paciente_id, cor, publico, autor_id, autor_papel, criado_em, reclassificacao, motivo)
VALUES ('25000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000097', '23000000-0000-4000-8000-000000000971',
        'amarelo', 'adulto', '10000000-0000-4000-8000-000000000004', 'enfermeiro', pg_temp.v('dia10')::timestamptz - interval '20 minutes', true, 'Piora');
-- medicação de P1: duas administrações no mesmo dia viram uma linha com quantidade 2
INSERT INTO public.prescricoes (id, unidade_id, paciente_id, medico_id, status, episodio_id)
VALUES ('26000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000097', '23000000-0000-4000-8000-000000000971',
        '10000000-0000-4000-8000-000000000002', 'ativa', '25000000-0000-4000-8000-000000000971');
INSERT INTO public.prescricao_itens (id, prescricao_id, descricao, tipo)
VALUES ('27000000-0000-4000-8000-000000000971', '26000000-0000-4000-8000-000000000971', 'Dipirona 1 g IV', 'medicamento'),
       ('27000000-0000-4000-8000-000000000972', '26000000-0000-4000-8000-000000000971', 'Cabeceira elevada', 'cuidado');
INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, situacao, registrado_por, registrado_em) VALUES
  ('27000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000097', 'feito',
   '10000000-0000-4000-8000-000000000004', pg_temp.v('dia10')::timestamptz + interval '10 minutes'),
  ('27000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000097', 'feito',
   '10000000-0000-4000-8000-000000000004', pg_temp.v('dia10')::timestamptz + interval '4 hours'),
  ('27000000-0000-4000-8000-000000000971', '23000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000097', 'recusado',
   '10000000-0000-4000-8000-000000000004', pg_temp.v('dia10')::timestamptz + interval '5 hours'),
  ('27000000-0000-4000-8000-000000000972', '23000000-0000-4000-8000-000000000971', '21000000-0000-4000-8000-000000000097', 'feito',
   '10000000-0000-4000-8000-000000000004', pg_temp.v('dia10')::timestamptz + interval '5 hours');

SET LOCAL ROLE authenticated;

-- ── 1. papel e configuração ─────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.bpa_conferencia('21000000-0000-4000-8000-000000000097', pg_temp.v('comp'))$$,
  'BPA da unidade: faturamento ou gestor', 'médico não abre a conferência do BPA');
SELECT pg_temp.falha($$SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301100039', 'lista')$$,
  'BPA da unidade', 'médico não associa código');

SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.fechar_competencia_bpa('21000000-0000-4000-8000-000000000097', pg_temp.v('comp'))$$,
  'Não dá para fechar: Cabeçalho incompleto', 'sem cabeçalho não fecha');
SELECT pg_temp.falha($$SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301069999', 'lista')$$,
  'Procedimento 0301069999 não existe no SIGTAP', 'código fora do SIGTAP recusado');
SELECT public.definir_bpa_config('21000000-0000-4000-8000-000000000097', jsonb_build_object(
  'orgao_origem', 'UPA do Teste', 'sigla', 'upat', 'cnpj', '11.222.333/0001-81', 'orgao_destino', 'Secretaria Municipal de Saúde',
  'destino', 'm', 'carater_atendimento', '02'));
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301060096', 'atendimento_medico');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301060118', 'classificacao');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301100012', 'medicacao');
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301100039', 'lista');
SELECT pg_temp.falha($$SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301100039', 'lista')$$,
  'Este procedimento já está na lista', 'lista sem repetido');
-- trocar o código de uma fonte encerra o anterior
SELECT public.associar_procedimento_bpa('21000000-0000-4000-8000-000000000097', '0301060096', 'atendimento_medico');
SELECT pg_temp.ok((SELECT count(*) FROM public.bpa_procedimentos_unidade
                    WHERE unidade_id = '21000000-0000-4000-8000-000000000097' AND uso = 'atendimento_medico') = 2
               AND (SELECT count(*) FROM public.bpa_procedimentos_unidade
                    WHERE unidade_id = '21000000-0000-4000-8000-000000000097' AND uso = 'atendimento_medico' AND vigente_ate IS NULL) = 1,
  'troca de código guarda o histórico');

-- ── 2. registro de procedimento ─────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000971', '0301060096', 1,
  '25000000-0000-4000-8000-000000000971', pg_temp.v('dia10')::timestamptz, '10000000-0000-4000-8000-000000000004')$$,
  'Procedimento fora da lista da unidade', 'só procedimento da lista');
SELECT pg_temp.falha($$SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000971', '0301100039', 1,
  '25000000-0000-4000-8000-000000000972', pg_temp.v('dia10')::timestamptz, '10000000-0000-4000-8000-000000000004')$$,
  'O atendimento não é deste paciente', 'episódio de outro paciente recusado');
INSERT INTO t SELECT 'reg1', public.registrar_procedimento('23000000-0000-4000-8000-000000000971', '0301100039', 1,
  '25000000-0000-4000-8000-000000000971', pg_temp.v('dia10')::timestamptz + interval '1 hour', '10000000-0000-4000-8000-000000000004')::text;
SELECT pg_temp.ok((SELECT via = 'faturamento' AND registrado_por = '10000000-0000-4000-8000-000000000005'
                          AND profissional_id = '10000000-0000-4000-8000-000000000004' AND cbo = '223505'
                     FROM public.procedimentos_realizados WHERE id = pg_temp.v('reg1')::uuid),
  'faturamento lança em nome de quem fez; autor é o login');
-- quem não é faturamento não lança em nome de outro
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000971', '0301100039', 1,
  NULL, NULL, '10000000-0000-4000-8000-000000000004')$$,
  'Só o faturamento lança procedimento em nome de outro', 'médico não lança em nome da enfermagem');

-- ── 3. conferência ──────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'conf', public.bpa_conferencia('21000000-0000-4000-8000-000000000097', pg_temp.v('comp'))::text;
-- 3 atendimentos + 3 classificações + 1 medicação + 1 registro
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb ->> 'total')::int = 8, 'conferência: 8 linhas');
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb -> 'por_origem' ->> 'classificacao')::int = 3, 'só a primeira classificação do episódio');
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb -> 'por_origem' ->> 'medicacao')::int = 1, 'medicação somada por dia; cuidado e recusa fora');
-- P2 (raça sem informação): atendimento e classificação com crítica
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb ->> 'com_critica')::int = 2, 'raça "sem informação" barra as 2 linhas de P2');
SELECT pg_temp.ok((pg_temp.v('conf')::jsonb -> 'por_critica' ->> 'raca')::int = 2
               AND (pg_temp.v('conf')::jsonb -> 'por_critica' ->> 'documento')::int = 2
               AND (pg_temp.v('conf')::jsonb -> 'por_critica' ->> 'endereco')::int = 2,
  'P2: críticas de raça e avisos de documento e endereço');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('conf')::jsonb -> 'globais') g WHERE g->>'codigo' = 'ine')
               AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('conf')::jsonb -> 'globais') g WHERE g->>'tipo' = 'bloqueio'),
  'INE vazio é aviso, sem bloqueio');

-- ── 4. fechamento e arquivo ─────────────────────────────────────────────────
INSERT INTO t SELECT 'fech', public.fechar_competencia_bpa('21000000-0000-4000-8000-000000000097', pg_temp.v('comp'))::text;
INSERT INTO t SELECT 'arq', public.arquivo_bpa(pg_temp.v('fech')::uuid) ->> 'conteudo';
CREATE TEMP VIEW linhas_arq AS
  SELECT n, l FROM unnest(string_to_array(pg_temp.v('arq'), E'\r\n')) WITH ORDINALITY AS x(l, n) WHERE l <> '';
GRANT SELECT ON linhas_arq TO authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM linhas_arq) = 7 AND right(pg_temp.v('arq'), 2) = E'\r\n',
  'arquivo: cabeçalho + 6 linhas, CR+LF');
SELECT pg_temp.ok((SELECT length(l) FROM linhas_arq WHERE n = 1) = 130
               AND NOT EXISTS (SELECT 1 FROM linhas_arq WHERE n > 1 AND length(l) <> 351),
  'tamanhos do leiaute: 132 e 353 com CR+LF');
SELECT pg_temp.ok((SELECT substr(l, 1, 7) = '01#BPA#' AND substr(l, 8, 6) = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')
                          AND substr(l, 14, 6) = '000006' AND substr(l, 20, 6) = '000002'
                          AND substr(l, 60, 6) = 'UPAT  ' AND substr(l, 66, 14) = '11222333000181' AND substr(l, 120, 1) = 'M'
                     FROM linhas_arq WHERE n = 1),
  'cabeçalho: processamento, 6 linhas, 2 folhas (médico e enfermeiro), sigla, CNPJ, destino');
-- campo de controle calculado à parte
SELECT pg_temp.ok((SELECT substr(l, 26, 4) FROM linhas_arq WHERE n = 1)
                  = ((SELECT sum(substr(l, 50, 10)::bigint + substr(l, 89, 6)::bigint) FROM linhas_arq WHERE n > 1) % 1111 + 1111)::text,
  'campo de controle = (procedimentos + quantidades) mod 1111 + 1111');
SELECT pg_temp.ok((SELECT count(*) FROM linhas_arq WHERE n > 1 AND substr(l, 3, 7) = '7654321' AND substr(l, 10, 6) = pg_temp.v('comp')
                     AND substr(l, 110, 3) = 'BPA' AND substr(l, 95, 2) = '02') = 6,
  'linhas: CNES, competência de realização, origem BPA, caráter');
-- P1: CNS no campo do paciente, CPF em branco, nome sem acento, raça parda, IBGE, telefone
SELECT pg_temp.ok((SELECT bool_and(substr(l, 60, 15) = '798682828807290' AND substr(l, 339, 11) = '           '
                                   AND substr(l, 113, 30) = rpad('JOSE DA CONFERENCIA AVILA', 30)
                                   AND substr(l, 151, 2) = '03' AND substr(l, 76, 6) = '355030' AND substr(l, 278, 11) = '11987654321'
                                   AND substr(l, 75, 1) = 'M' AND substr(l, 143, 8) = '19800315' AND substr(l, 350, 2) = 'NN')
                     FROM linhas_arq WHERE n > 1 AND substr(l, 113, 4) = 'JOSE'),
  'P1: CNS (CPF em branco), nome sem acento, raça 03, IBGE, telefone, nascimento');
-- P3: CPF no campo, CNS em branco; número "SN"
SELECT pg_temp.ok((SELECT bool_and(substr(l, 60, 15) = repeat(' ', 15) AND substr(l, 339, 11) = '52998224725'
                                   AND substr(l, 243, 5) = 'SN   ' AND substr(l, 86, 3) = '0' || lpad(extract(year FROM age((pg_temp.v('dia10')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date, date '2015-07-20'))::text, 2, '0'))
                     FROM linhas_arq WHERE n > 1 AND substr(l, 113, 3) = 'ANA'),
  'P3: CPF no lugar do CNS, número SN, idade na data');
SELECT pg_temp.ok((SELECT substr(l, 89, 6) FROM linhas_arq WHERE n > 1 AND substr(l, 50, 10) = '0301100012') = '000002'
               AND (SELECT substr(l, 31, 6) FROM linhas_arq WHERE n > 1 AND substr(l, 50, 10) = '0301100012') = '223505',
  'medicação: quantidade 2, CBO do enfermeiro');
-- folhas: uma por profissional (enfermeiro: 4 linhas; médico: 2, P2 fora), linhas 01..n
SELECT pg_temp.ok((SELECT string_agg(substr(l, 16, 15) || ':' || substr(l, 45, 3) || substr(l, 48, 2), ',' ORDER BY n) FROM linhas_arq WHERE n > 1)
                  LIKE '714852538885393:00101,714852538885393:00102,714852538885393:00103,714852538885393:00104,796030824628194:00101,796030824628194:00102',
  'folha 001 por profissional, linhas 01..n');
SELECT pg_temp.ok((SELECT jsonb_array_length(excluidas) FROM public.bpa_fechamentos WHERE id = pg_temp.v('fech')::uuid) = 2,
  'as 2 linhas com crítica ficam registradas como excluídas');

-- ── 5. competência fechada trava; reabertura com motivo ─────────────────────
SELECT pg_temp.falha($$SELECT public.registrar_procedimento('23000000-0000-4000-8000-000000000971', '0301100039', 1,
  NULL, pg_temp.v('dia10')::timestamptz, '10000000-0000-4000-8000-000000000004')$$,
  'A competência ' || pg_temp.v('comp') || ' já foi fechada', 'competência fechada não aceita registro');
SELECT pg_temp.falha($$SELECT public.cancelar_procedimento_realizado(pg_temp.v('reg1')::uuid, 'lançado em duplicidade')$$,
  'A competência ' || pg_temp.v('comp') || ' já foi fechada', 'competência fechada não aceita cancelamento');
SELECT pg_temp.falha($$SELECT public.fechar_competencia_bpa('21000000-0000-4000-8000-000000000097', pg_temp.v('comp'))$$,
  'Competência já fechada', 'não fecha duas vezes');
SELECT pg_temp.falha($$SELECT public.reabrir_competencia_bpa(pg_temp.v('fech')::uuid, 'curto')$$,
  'Escreva o motivo', 'reabrir pede motivo');
SELECT public.reabrir_competencia_bpa(pg_temp.v('fech')::uuid, 'Corrigir raça/cor da paciente Maria');
SELECT public.cancelar_procedimento_realizado(pg_temp.v('reg1')::uuid, 'Lançado em duplicidade');
INSERT INTO t SELECT 'fech2', public.fechar_competencia_bpa('21000000-0000-4000-8000-000000000097', pg_temp.v('comp'))::text;
SELECT pg_temp.ok((SELECT linhas FROM public.bpa_fechamentos WHERE id = pg_temp.v('fech2')::uuid) = 5
               AND (SELECT situacao FROM public.bpa_fechamentos WHERE id = pg_temp.v('fech')::uuid) = 'reaberta',
  'reaberta, refechada sem o registro cancelado; histórico mantido');

-- ── 6. CNS do perfil e endereço do SUS ──────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.definir_meu_cns('123456789012345')$$, 'Cartão SUS inválido', 'CNS do perfil conferido');
SELECT public.definir_meu_cns('712402344834782');
SELECT pg_temp.ok((SELECT cns FROM public.perfis WHERE id = '10000000-0000-4000-8000-000000000005') = '712402344834782', 'CNS do perfil gravado');
SELECT public.salvar_endereco_sus('23000000-0000-4000-8000-000000000972',
  jsonb_build_object('municipio_ibge', '3550308', 'cep', '01310-100', 'numero_endereco', 'sn', 'situacao_rua', true));
SELECT pg_temp.ok((SELECT e->>'municipio_ibge' = '355030' AND e->>'cep' = '01310100' AND e->>'numero_endereco' = 'SN'
                          AND (e->>'situacao_rua')::boolean
                     FROM public.endereco_sus('23000000-0000-4000-8000-000000000972') e),
  'endereço do SUS: IBGE de 7 dígitos vira 6, CEP só dígitos');
SELECT pg_temp.falha($$SELECT public.salvar_endereco_sus('23000000-0000-4000-8000-000000000972', '{"bairro": "Um bairro com nome comprido demais para o BPA"}')$$,
  'Confira os campos', 'bairro maior que o leiaute recusado');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.salvar_endereco_sus('23000000-0000-4000-8000-000000000972', '{"cep": "01310100"}')$$,
  'Acesso negado', 'fora do plantão e sem faturamento não mexe no endereço');

-- ── 7. CNES pelo gestor (decisão do RT de 10/10/2026) ───────────────────────
SELECT pg_temp.falha($$SELECT public.definir_cnes_unidade('21000000-0000-4000-8000-000000000097', '1234567')$$,
  'O CNES da unidade é preenchido pelo gestor', 'só o gestor define o CNES');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.definir_cnes_unidade('21000000-0000-4000-8000-000000000001', '12345')$$,
  'CNES com 7 dígitos', 'CNES com 7 dígitos');
SELECT pg_temp.falha($$SELECT public.definir_cnes_unidade('21000000-0000-4000-8000-000000000001', '7654321')$$,
  'Este CNES já está em outra unidade', 'CNES não se repete entre unidades');
SELECT pg_temp.ok(public.definir_cnes_unidade('21000000-0000-4000-8000-000000000001', '2.077.485') = '2077485', 'gestor grava o CNES (só dígitos)');

ROLLBACK;
