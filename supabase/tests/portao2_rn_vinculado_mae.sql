-- Testes da migration 20261124000001_rn_vinculado_mae.sql (Portão 2, tarefa 5,
-- lacuna R2.6): recém-nascido "RN de <mãe>" ligado ao cadastro da mãe; na
-- regulação, sai identificado pelo documento da mãe. ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.cid10 (codigo, descricao) VALUES ('P22.0', 'CID do teste P22.0') ON CONFLICT DO NOTHING;
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
-- rede de teste com origem (com CNES), destino e central
INSERT INTO public.organizacoes (id, nome) VALUES ('20000000-0000-4000-8000-000000000095', 'Rede do RN');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, '20000000-0000-4000-8000-000000000095', x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-000000000951'::uuid, 'Maternidade Origem', '7654351'),
               ('21000000-0000-4000-8000-000000000952'::uuid, 'Hospital Destino RN', NULL),
               ('21000000-0000-4000-8000-000000000953'::uuid, 'Central do RN', NULL)) x(id, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT '22000000-0000-4000-8000-000000000951', '21000000-0000-4000-8000-000000000951', 'Alojamento', tipo
  FROM public.setores WHERE id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000951', 'gestor');
-- mães: uma com CNS, outra sem documento
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cns, cpf) VALUES
  ('23000000-0000-4000-8000-000000000951', '21000000-0000-4000-8000-000000000951', 'Maria Teste da Silva', '1995-04-04', 'M-1',
   '22000000-0000-4000-8000-000000000951', 'F', '798682828807290', NULL),
  ('23000000-0000-4000-8000-000000000952', '21000000-0000-4000-8000-000000000951', 'Joana Sem Documento', '1999-09-09', 'M-2',
   '22000000-0000-4000-8000-000000000951', 'F', NULL, NULL),
  ('23000000-0000-4000-8000-000000000953', '21000000-0000-4000-8000-000000000952', 'Mãe De Outra Unidade', '1990-01-01', 'M-3',
   NULL, 'F', NULL, NULL);

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
CREATE FUNCTION pg_temp.pedido(extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('tipo', 'leito', 'tipo_leito', 'uti_neonatal', 'procedimento', '0303060190', 'destino_tipo', 'rede',
    'destino_unidade_id', '21000000-0000-4000-8000-000000000952', 'carater', 'urgencia', 'prioridade', 'emergencia', 'cid', 'P22.0',
    'quadro_clinico', 'Recém-nascido com desconforto respiratório precoce, precisa de UTI neonatal.', 'tempo_evolucao', '2 horas',
    'sinais_vitais', 'FC 170, FR 70, SpO2 88% em ar ambiente') || extra $$;
GRANT EXECUTE ON FUNCTION pg_temp.pedido(jsonb) TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
SELECT public.regulacao_definir_central('21000000-0000-4000-8000-000000000953');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');

-- 1a, 2a. RN de mãe cadastrada, até 27 dias
INSERT INTO t SELECT 'rn', public.cadastrar_rn('23000000-0000-4000-8000-000000000951', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 2, 'F') ->> 'paciente_id';
SELECT pg_temp.falha($$SELECT public.cadastrar_rn('23000000-0000-4000-8000-000000000951', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 2)$$,
  'Já existe recém-nascido de Maria Teste da Silva', 'o mesmo RN não se cadastra duas vezes');
SELECT pg_temp.falha($$SELECT public.cadastrar_rn('23000000-0000-4000-8000-000000000951', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 28)$$,
  'O cadastro "RN de" é só até 27 dias de vida', 'acima de 27 dias não é "RN de"');
SELECT pg_temp.falha($$SELECT public.cadastrar_rn('23000000-0000-4000-8000-000000000951', (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1)$$,
  'Informe a data de nascimento do recém-nascido', 'nascimento no futuro recusado');
SELECT pg_temp.falha($$SELECT public.cadastrar_rn('23000000-0000-4000-8000-000000000953', (now() AT TIME ZONE 'America/Sao_Paulo')::date)$$,
  'Acesso negado', 'mãe de unidade onde não há vínculo nem escala: recusado');
-- 3a. gêmeos
INSERT INTO t SELECT 'g1', public.cadastrar_rn('23000000-0000-4000-8000-000000000952', (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'M', 1::smallint) ->> 'paciente_id';
INSERT INTO t SELECT 'g2', public.cadastrar_rn('23000000-0000-4000-8000-000000000952', (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'F', 2::smallint) ->> 'paciente_id';
SELECT pg_temp.falha($$SELECT public.cadastrar_rn('23000000-0000-4000-8000-000000000952', (now() AT TIME ZONE 'America/Sao_Paulo')::date)$$,
  'Já existe recém-nascido de Joana Sem Documento', 'gêmeos: sem a ordem, recusado');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT nome || '|' || mae_id || '|' || nome_mae || '|' || responsavel_parentesco FROM public.pacientes WHERE id = pg_temp.u('rn'))
     <> 'RN de Maria Teste da Silva|23000000-0000-4000-8000-000000000951|Maria Teste da Silva|mãe' THEN
    RAISE EXCEPTION 'FALHOU: cadastro do RN';
  END IF;
  IF (SELECT string_agg(nome, ',' ORDER BY rn_ordem) FROM public.pacientes WHERE mae_id = '23000000-0000-4000-8000-000000000952')
     <> 'RN 1 de Joana Sem Documento,RN 2 de Joana Sem Documento' THEN
    RAISE EXCEPTION 'FALHOU: nomes dos gêmeos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.log_auditoria WHERE acao = 'cadastrar_rn' AND entidade_id = pg_temp.u('rn')) THEN
    RAISE EXCEPTION 'FALHOU: cadastro do RN sem auditoria';
  END IF;
  RAISE NOTICE 'OK  "RN de <mãe>" e "RN 1/2 de <mãe>" ligados ao cadastro da mãe, com auditoria';
END $$;

-- 4a. regulação: RN de mãe com CNS sai identificado; de mãe sem documento, não
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF NOT (public.regulacao_vinculos_paciente(pg_temp.u('rn')) ->> 'tem_documento')::boolean
     OR public.regulacao_vinculos_paciente(pg_temp.u('rn')) -> 'mae' ->> 'cns' <> '798682828807290'
     OR (public.regulacao_vinculos_paciente(pg_temp.u('g1')) ->> 'tem_documento')::boolean THEN
    RAISE EXCEPTION 'FALHOU: tela da regulação não vê o documento da mãe';
  END IF;
  RAISE NOTICE 'OK  tela da regulação: RN identificado pelo documento da mãe';
END $$;
INSERT INTO t SELECT 'sol', public.regulacao_solicitar('21000000-0000-4000-8000-000000000951', pg_temp.u('rn'), pg_temp.pedido()) ->> 'id';
SELECT pg_temp.falha(format('SELECT public.regulacao_solicitar(%L, %L, %L::jsonb)', '21000000-0000-4000-8000-000000000951', pg_temp.u('g1'), pg_temp.pedido()),
  'O paciente está sem CNS e sem CPF válidos', 'RN de mãe sem documento continua precisando da marca de não identificado');
RESET ROLE;
DO $$
DECLARE j jsonb;
BEGIN
  IF (SELECT paciente_nao_identificado FROM public.regulacao_solicitacoes WHERE id = pg_temp.u('sol')) THEN
    RAISE EXCEPTION 'FALHOU: RN de mãe com CNS saiu como não identificado';
  END IF;
  SELECT private.regulacao_json(s) INTO j FROM public.regulacao_solicitacoes s WHERE s.id = pg_temp.u('sol');
  IF j -> 'paciente' ->> 'nome' <> 'RN de Maria Teste da Silva' OR j -> 'paciente' -> 'mae' ->> 'cns' <> '798682828807290' THEN
    RAISE EXCEPTION 'FALHOU: a solicitação não mostra o documento da mãe: %', j -> 'paciente';
  END IF;
  RAISE NOTICE 'OK  regulação: RN sem CNS sai sem a marca de não identificado, com o documento da mãe';
END $$;

-- 6a. o RN ganha nome e CNS próprios no cadastro normal; o vínculo continua
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT public.salvar_cadastro_paciente(pg_temp.u('rn'), '{"nome": "Ana Clara Teste da Silva", "cns": "700000000000005"}'::jsonb);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT nome || '|' || cns || '|' || mae_id FROM public.pacientes WHERE id = pg_temp.u('rn'))
     <> 'Ana Clara Teste da Silva|700000000000005|23000000-0000-4000-8000-000000000951' THEN
    RAISE EXCEPTION 'FALHOU: nome e CNS próprios deveriam manter o vínculo com a mãe';
  END IF;
  IF has_function_privilege('anon', 'public.cadastrar_rn(uuid, date, text, smallint, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.paciente_tem_documento(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: função exposta';
  END IF;
  RAISE NOTICE 'OK  nome e CNS próprios pelo cadastro normal; vínculo com a mãe mantido';
END $$;
ROLLBACK;
