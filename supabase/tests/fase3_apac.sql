-- Fase 3, tarefa 5 — migration 20261104000001_apac.sql: APAC.
-- Unidade própria e SIGTAP de teste (banco limpo do CI). Cobre:
-- - solicitação pelo médico, com a crítica de instrumento;
-- - decisão do médico regulador (número, validade, rejeição com motivo);
-- - execução pelo faturamento (principal obrigatório, CBO aceito, validade,
--   uma por competência);
-- - conferência com as faltas de cadastro;
-- - arquivo do APAC Magnético (tamanhos, posições, campo de controle);
-- - competência fechada que trava, e reabertura.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

DELETE FROM terminologia.sigtap_procedimento_registro;
DELETE FROM terminologia.sigtap_procedimento_ocupacao;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0204030153', 'EXAME DE ALTA COMPLEXIDADE DO TESTE', '3', 'I', 0, 1571, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0204030161', 'EXAME SECUNDARIO DO TESTE', '3', 'I', 0, 1571, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')),
  ('0301060096', 'ATENDIMENTO MEDICO EM UNIDADE DE PRONTO ATENDIMENTO', '2', 'I', 0, 1571, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT (codigo) DO UPDATE SET competencia = EXCLUDED.competencia;
INSERT INTO terminologia.sigtap_procedimento_registro (procedimento, registro, competencia) VALUES
  ('0204030153', '06', '202609'), ('0204030161', '07', '202609'), ('0301060096', '01', '202609'), ('0301060096', '02', '202609');
INSERT INTO terminologia.sigtap_procedimento_ocupacao (procedimento, cbo, competencia) VALUES
  ('0204030153', '225125', '202609'), ('0204030161', '225125', '202609');
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('C50.9', 'CID do teste C50.9') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.cbo (codigo, titulo) VALUES ('225125', 'Médico clínico') ON CONFLICT DO NOTHING;

INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT '21000000-0000-4000-8000-000000000095', organizacao_id, 'Hospital do teste da APAC', tipo, '7654319', 'São Paulo', 'SP'
  FROM public.unidades WHERE id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000095', '21000000-0000-4000-8000-000000000095', 'PS da APAC', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000095', 'gestor'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000095', 'faturamento'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000095', 'regulador');
UPDATE public.perfis SET crm = '123456', uf_crm = 'SP', cns = '796030824628194', cbo = '225125' WHERE id = '10000000-0000-4000-8000-000000000001';
UPDATE public.perfis SET crm = '654321', uf_crm = 'SP', cns = '714852538885393' WHERE id = '10000000-0000-4000-8000-000000000006';

INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, raca_cor, nome_mae, nacionalidade)
VALUES ('23000000-0000-4000-8000-000000000951', '21000000-0000-4000-8000-000000000095', 'Clara da Apac', '1970-02-20', 'A-1',
        '22000000-0000-4000-8000-000000000095', 'F', '798682828807290', 'branca', 'Mãe da Clara', '010');

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
INSERT INTO t VALUES
  ('comp', to_char((now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month', 'YYYYMM')),
  ('ini', to_char(date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month'), 'YYYY-MM-DD')),
  ('fim', to_char(date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month - 1 day', 'YYYY-MM-DD'));
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
CREATE FUNCTION pg_temp.dados(proc text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('procedimento', proc, 'cid', 'C50.9', 'carater', '01', 'tipo', '3',
    'justificativa', jsonb_build_object('justificativa', 'Exame necessário para estadiamento (teste).')) $$;
GRANT EXECUTE ON FUNCTION pg_temp.dados(text) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. solicitação ──────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.solicitar_apac('23000000-0000-4000-8000-000000000951', pg_temp.dados('0301060096'))$$,
  'Crítica bloqueante da APAC: O SIGTAP não registra este procedimento como principal de APAC', 'só procedimento de APAC no SIGTAP');
SELECT pg_temp.falha($$SELECT public.solicitar_apac('23000000-0000-4000-8000-000000000951',
  pg_temp.dados('0204030153') || '{"justificativa": {"justificativa": "curta"}}')$$, 'Escreva a justificativa', 'justificativa obrigatória');
SELECT pg_temp.falha($$SELECT public.solicitar_apac('23000000-0000-4000-8000-000000000951', pg_temp.dados('0204030153') || '{"tipo": "2"}')$$,
  'APAC de continuidade pede o número da APAC anterior', 'continuidade pede a APAC anterior');
INSERT INTO t SELECT 'apac', public.solicitar_apac('23000000-0000-4000-8000-000000000951', pg_temp.dados('0204030153'))::text;
SELECT pg_temp.ok((SELECT status = 'solicitada' AND sigtap_competencia IS NOT NULL FROM public.apacs WHERE id = pg_temp.v('apac')::uuid),
  'APAC solicitada, com a competência do SIGTAP');

-- ── 2. decisão ──────────────────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.decidir_apac(pg_temp.v('apac')::uuid, true, '3526100000011', pg_temp.v('ini')::date, pg_temp.v('fim')::date)$$,
  'A decisão da APAC é do médico regulador', 'quem não é regulador não decide');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.registrar_execucao_apac(pg_temp.v('apac')::uuid, pg_temp.v('comp'), '01', '21', NULL,
  '10000000-0000-4000-8000-000000000001', '[{"procedimento": "0204030153", "quantidade": 1}]')$$,
  'Só APAC autorizada tem execução', 'sem autorização não há execução');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.decidir_apac(pg_temp.v('apac')::uuid, true, '123', pg_temp.v('ini')::date, pg_temp.v('fim')::date)$$,
  'Número da APAC com 13 dígitos', 'número com 13 dígitos');
SELECT pg_temp.falha($$SELECT public.decidir_apac(pg_temp.v('apac')::uuid, true, '3526100000011', pg_temp.v('fim')::date, pg_temp.v('ini')::date)$$,
  'Validade: início e fim', 'fim da validade depois do início');
SELECT public.decidir_apac(pg_temp.v('apac')::uuid, true, '3526100000011', pg_temp.v('ini')::date, pg_temp.v('fim')::date);
SELECT pg_temp.ok((SELECT status = 'autorizada' AND numero = '3526100000011' FROM public.apacs WHERE id = pg_temp.v('apac')::uuid),
  'regulador autoriza com número e validade');
-- outra solicitação, rejeitada com motivo
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
INSERT INTO t SELECT 'apac2', public.solicitar_apac('23000000-0000-4000-8000-000000000951', pg_temp.dados('0204030153'))::text;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.decidir_apac(pg_temp.v('apac2')::uuid, false, NULL, NULL, NULL, 'curto')$$, 'Escreva o motivo da rejeição', 'rejeição pede motivo');
SELECT public.decidir_apac(pg_temp.v('apac2')::uuid, false, NULL, NULL, NULL, 'Solicitação em duplicidade');
SELECT pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(public.eventos_apac(pg_temp.v('apac2')::uuid))) = 2, 'histórico: solicitada e rejeitada');

-- ── 3. execução ─────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.falha($$SELECT public.registrar_execucao_apac(pg_temp.v('apac')::uuid, pg_temp.v('comp'), '01', '21', NULL,
  '10000000-0000-4000-8000-000000000001', '[{"procedimento": "0204030161", "quantidade": 1}]')$$,
  'A execução inclui o procedimento principal', 'execução inclui o principal');
SELECT pg_temp.falha($$SELECT public.registrar_execucao_apac(pg_temp.v('apac')::uuid,
  to_char((now() AT TIME ZONE 'America/Sao_Paulo') + interval '2 months', 'YYYYMM'), '01', '21', NULL,
  '10000000-0000-4000-8000-000000000001', '[{"procedimento": "0204030153", "quantidade": 1}]')$$,
  'Competência fora da validade', 'competência dentro da validade');
SELECT pg_temp.falha($$SELECT public.registrar_execucao_apac(pg_temp.v('apac')::uuid, pg_temp.v('comp'), '01', '21', NULL,
  '10000000-0000-4000-8000-000000000006', '[{"procedimento": "0204030153", "quantidade": 1}]')$$,
  'O executante não tem CBO no perfil', 'executante com CBO no perfil');
INSERT INTO t SELECT 'exec', public.registrar_execucao_apac(pg_temp.v('apac')::uuid, pg_temp.v('comp'), '01', '21', NULL,
  '10000000-0000-4000-8000-000000000001', '[{"procedimento": "0204030153", "quantidade": 1}, {"procedimento": "0204030161", "quantidade": 2}]')::text;
SELECT pg_temp.falha($$SELECT public.registrar_execucao_apac(pg_temp.v('apac')::uuid, pg_temp.v('comp'), '01', '21', NULL,
  '10000000-0000-4000-8000-000000000001', '[{"procedimento": "0204030153", "quantidade": 1}]')$$,
  'Já há execução desta APAC na competência', 'uma execução por competência');

-- ── 4. conferência e arquivo ────────────────────────────────────────────────
SELECT pg_temp.falha($$SELECT public.fechar_competencia_apac('21000000-0000-4000-8000-000000000095', pg_temp.v('comp'))$$,
  'Não dá para fechar: Cabeçalho incompleto', 'sem cabeçalho e órgão emissor não fecha');
SELECT public.definir_bpa_config('21000000-0000-4000-8000-000000000095', jsonb_build_object(
  'orgao_origem', 'Hospital APAC', 'sigla', 'HAPAC', 'cnpj', '11222333000181', 'orgao_destino', 'SES Teste', 'destino', 'E'));
SELECT public.definir_apac_orgao_emissor('21000000-0000-4000-8000-000000000095', 'E350000001');
INSERT INTO t SELECT 'conf', public.apac_conferencia('21000000-0000-4000-8000-000000000095', pg_temp.v('comp'))::text;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(pg_temp.v('conf')::jsonb -> 'linhas') l, jsonb_array_elements(l -> 'criticas') c
                           WHERE c->>'codigo' = 'endereco'), 'conferência aponta o endereço que falta');
SELECT public.salvar_endereco_sus('23000000-0000-4000-8000-000000000951', jsonb_build_object(
  'cep', '01310100', 'municipio_ibge', '355030', 'endereco', 'Rua da Apac', 'numero_endereco', '45', 'bairro', 'Centro', 'tipo_logradouro', '081'));
INSERT INTO t SELECT 'fech', public.fechar_competencia_apac('21000000-0000-4000-8000-000000000095', pg_temp.v('comp'))::text;
INSERT INTO t SELECT 'arq', public.arquivo_apac(pg_temp.v('fech')::uuid) ->> 'conteudo';
CREATE TEMP VIEW linhas_arq AS
  SELECT n, l FROM unnest(string_to_array(pg_temp.v('arq'), E'\r\n')) WITH ORDINALITY AS x(l, n) WHERE l <> '';
GRANT SELECT ON linhas_arq TO authenticated;
SELECT pg_temp.ok((SELECT string_agg(left(l, 2), ',' ORDER BY n) FROM linhas_arq) = '01,14,13,13,06', 'arquivo: cabeçalho, corpo, 2 procedimentos, laudo geral');
SELECT pg_temp.ok((SELECT length(l) FROM linhas_arq WHERE left(l, 2) = '01') = 137
               AND (SELECT length(l) FROM linhas_arq WHERE left(l, 2) = '14') = 537
               AND NOT EXISTS (SELECT 1 FROM linhas_arq WHERE left(l, 2) = '13' AND length(l) <> 97)
               AND (SELECT length(l) FROM linhas_arq WHERE left(l, 2) = '06') = 37,
  'tamanhos do leiaute: 139, 539, 99 e 39 com CR+LF');
SELECT pg_temp.ok((SELECT substr(l, 3, 5) = '#APAC' AND substr(l, 8, 6) = pg_temp.v('comp') AND substr(l, 14, 6) = '000001'
                          AND substr(l, 54, 6) = 'HAPAC ' AND substr(l, 114, 1) = 'E' FROM linhas_arq WHERE left(l, 2) = '01'),
  'cabeçalho: competência, 1 APAC, sigla, destino');
SELECT pg_temp.ok((SELECT substr(l, 20, 4) FROM linhas_arq WHERE left(l, 2) = '01')
                  = (((SELECT sum(substr(l, 22, 10)::bigint + substr(l, 38, 7)::bigint) FROM linhas_arq WHERE left(l, 2) = '13')
                      + 3526100000011) % 1111 + 1111)::text,
  'campo de controle: procedimentos + quantidades + número da APAC');
SELECT pg_temp.ok((SELECT substr(l, 9, 13) = '3526100000011' AND substr(l, 22, 2) = '35' AND substr(l, 24, 7) = '7654319'
                          AND substr(l, 57, 1) = '3' AND substr(l, 58, 30) = rpad('CLARA DA APAC', 30)
                          AND substr(l, 171, 7) = '355030 ' AND substr(l, 186, 1) = 'F' AND substr(l, 217, 10) = '0204030153'
                          AND substr(l, 227, 2) = '21' AND substr(l, 267, 15) = '798682828807290'
                          AND substr(l, 282, 15) = '796030824628194' AND substr(l, 297, 15) = '714852538885393'
                          AND substr(l, 349, 10) = 'E350000001' AND substr(l, 359, 2) = '01' AND substr(l, 374, 2) = '01'
                          AND substr(l, 376, 30) = rpad('CLARA DA APAC', 30)
                          AND substr(l, 406, 3) = '010' AND substr(l, 497, 15) = '796030824628194'
                     FROM linhas_arq WHERE left(l, 2) = '14'),
  'corpo: número, UF, CNES, tipo, paciente, município, procedimento, motivo, CNS de paciente/solicitante/autorizador/executante, emissor, caráter, raça, responsável');
SELECT pg_temp.ok((SELECT string_agg(substr(l, 22, 10) || ':' || substr(l, 32, 6) || ':' || substr(l, 38, 7), ',' ORDER BY n) FROM linhas_arq WHERE left(l, 2) = '13')
                  = '0204030153:225125:0000001,0204030161:225125:0000002'
               AND (SELECT substr(l, 22, 4) FROM linhas_arq WHERE left(l, 2) = '06') = 'C509',
  'procedimentos com CBO e quantidade; laudo geral com o CID');

-- ── 5. competência fechada trava; reabertura ────────────────────────────────
SELECT pg_temp.falha($$SELECT public.cancelar_execucao_apac(pg_temp.v('exec')::uuid, 'Lançada errada no teste')$$,
  'A competência ' || pg_temp.v('comp') || ' da APAC já foi fechada', 'competência fechada não aceita mudança');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.falha($$SELECT public.cancelar_apac(pg_temp.v('apac')::uuid, 'Cancelamento indevido no teste')$$,
  'A APAC tem execução registrada', 'APAC com execução não é cancelada');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT public.reabrir_competencia_apac(pg_temp.v('fech')::uuid, 'Corrigir a quantidade do secundário');
SELECT public.cancelar_execucao_apac(pg_temp.v('exec')::uuid, 'Quantidade do secundário errada');
SELECT pg_temp.ok((SELECT count(*) FROM public.apac_execucoes WHERE apac_id = pg_temp.v('apac')::uuid AND cancelado_em IS NULL) = 0,
  'reaberta, a execução é cancelada com motivo');

ROLLBACK;
