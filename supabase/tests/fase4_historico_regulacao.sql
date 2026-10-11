-- Fase 4, tarefa 5 — migration 20261111000001_historico_regulacao.sql:
-- histórico de regulação no prontuário. Cobre:
-- - alcance de rede: pedidos do mesmo paciente em outra unidade da organização
--   (CPF ou CNS válido; cadastro unificado); outra organização não entra;
-- - quem vê (médico e gestor da unidade; enfermagem e outra unidade não);
-- - a lista não registra acesso; o detalhe registra, na unidade do pedido.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO terminologia.sigtap_procedimento (codigo, nome, complexidade, sexo, idade_min, idade_max, competencia) VALUES
  ('0303060190', 'TRATAMENTO DE IAM DO TESTE', '2', 'I', 0, 1560, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))
ON CONFLICT DO NOTHING;

INSERT INTO public.organizacoes (id, nome) VALUES
  ('20000000-0000-4000-8000-0000000009b0', 'Rede do Histórico'), ('20000000-0000-4000-8000-0000000009c0', 'Outra Rede');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
SELECT x.id, x.org, x.nome, u.tipo, x.cnes, 'Campinas', 'SP'
  FROM public.unidades u,
       (VALUES ('21000000-0000-4000-8000-0000000009b1'::uuid, '20000000-0000-4000-8000-0000000009b0'::uuid, 'UPA Oeste', '7654423'),
               ('21000000-0000-4000-8000-0000000009b2'::uuid, '20000000-0000-4000-8000-0000000009b0'::uuid, 'Hospital Oeste', '7654431'),
               ('21000000-0000-4000-8000-0000000009b3'::uuid, '20000000-0000-4000-8000-0000000009b0'::uuid, 'Central Oeste', NULL),
               ('21000000-0000-4000-8000-0000000009c1'::uuid, '20000000-0000-4000-8000-0000000009c0'::uuid, 'UPA de Outra Rede', '7654440')) x(id, org, nome, cnes)
 WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.setores (id, unidade_id, nome, tipo)
SELECT x.id, x.un, 'Setor', s.tipo FROM public.setores s,
       (VALUES ('22000000-0000-4000-8000-0000000009b1'::uuid, '21000000-0000-4000-8000-0000000009b1'::uuid),
               ('22000000-0000-4000-8000-0000000009b2'::uuid, '21000000-0000-4000-8000-0000000009b2'::uuid),
               ('22000000-0000-4000-8000-0000000009c1'::uuid, '21000000-0000-4000-8000-0000000009c1'::uuid)) x(id, un)
 WHERE s.id = '22000000-0000-4000-8000-000000000001';
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
VALUES ('20000000-0000-4000-8000-0000000009b0', '21000000-0000-4000-8000-0000000009b3', '10000000-0000-4000-8000-000000000003');
-- 002 médico da UPA; 006 médico do hospital; 004 enfermeiro do hospital; 001 gestor do hospital; 005 médico da outra rede
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-0000000009b1', 'plantonista'),
  ('10000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-0000000009b2', 'plantonista'),
  ('10000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-0000000009b2', 'enfermeiro'),
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-0000000009b2', 'gestor'),
  ('10000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-0000000009c1', 'plantonista');
-- a mesma pessoa (CPF 529.982.247-25) na UPA, no hospital e na outra rede; e outra pessoa no hospital
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, prontuario, setor_id, sexo, cpf) VALUES
  ('23000000-0000-4000-8000-0000000009b1', '21000000-0000-4000-8000-0000000009b1', 'Joana Oeste', '1960-01-01', 'O-1', '22000000-0000-4000-8000-0000000009b1', 'F', '52998224725'),
  ('23000000-0000-4000-8000-0000000009b2', '21000000-0000-4000-8000-0000000009b2', 'Joana Oeste', '1960-01-01', 'O-2', '22000000-0000-4000-8000-0000000009b2', 'F', '52998224725'),
  ('23000000-0000-4000-8000-0000000009b3', '21000000-0000-4000-8000-0000000009b2', 'Outra Pessoa', '1980-01-01', 'O-3', '22000000-0000-4000-8000-0000000009b2', 'M', '11144477735'),
  ('23000000-0000-4000-8000-0000000009c1', '21000000-0000-4000-8000-0000000009c1', 'Joana Oeste', '1960-01-01', 'X-1', '22000000-0000-4000-8000-0000000009c1', 'F', '52998224725');
-- pedidos: um da UPA (Joana), um do hospital (Joana), um do hospital (outra pessoa)
INSERT INTO public.regulacao_solicitacoes (id, organizacao_id, central_id, unidade_origem_id, cnes_solicitante, paciente_id, tipo, procedimento,
  tipo_leito, destino_tipo, carater, modalidade, prioridade, cid, quadro_clinico, solicitante_id, solicitante_papel, criada_em)
VALUES
  ('2a000000-0000-4000-8000-0000000009b1', '20000000-0000-4000-8000-0000000009b0', '21000000-0000-4000-8000-0000000009b3', '21000000-0000-4000-8000-0000000009b1',
   '7654423', '23000000-0000-4000-8000-0000000009b1', 'leito', '0303060190', 'uti_adulto', 'a_definir', 'urgencia', '04', 'urgencia', 'I21.9',
   'Quadro clínico do pedido feito na UPA, dor torácica.', '10000000-0000-4000-8000-000000000002', 'medico', now() - interval '3 days'),
  ('2a000000-0000-4000-8000-0000000009b2', '20000000-0000-4000-8000-0000000009b0', '21000000-0000-4000-8000-0000000009b3', '21000000-0000-4000-8000-0000000009b2',
   '7654431', '23000000-0000-4000-8000-0000000009b2', 'leito', '0303060190', 'clinico', 'a_definir', 'eletivo', '04', 'eletiva', 'I21.9',
   'Quadro clínico do pedido feito no hospital, estável.', '10000000-0000-4000-8000-000000000006', 'medico', now() - interval '1 day'),
  ('2a000000-0000-4000-8000-0000000009b3', '20000000-0000-4000-8000-0000000009b0', '21000000-0000-4000-8000-0000000009b3', '21000000-0000-4000-8000-0000000009b2',
   '7654431', '23000000-0000-4000-8000-0000000009b3', 'leito', '0303060190', 'clinico', 'a_definir', 'eletivo', '04', 'eletiva', 'I21.9',
   'Quadro clínico do pedido de outra pessoa no hospital.', '10000000-0000-4000-8000-000000000006', 'medico', now());

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
CREATE FUNCTION pg_temp.acessos(unidade text) RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.log_acesso_prontuario WHERE unidade_id = unidade::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.acessos(text) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── 1. alcance de rede ──────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')) = 2,
  'médico do hospital vê os dois pedidos da Joana (do hospital e da UPA), não o de outra pessoa');
SELECT pg_temp.ok((public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')->1->>'origem') = 'UPA Oeste'
              AND (public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')->1->>'outra_unidade')::boolean
              AND NOT (public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')->0->>'outra_unidade')::boolean,
  'o pedido da UPA aparece marcado como de outra unidade');
SELECT pg_temp.ok(pg_temp.acessos('21000000-0000-4000-8000-0000000009b1') = 0, 'a lista não registra acesso');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009c1')) = 0,
  'outra organização não vê os pedidos da rede, mesmo com o mesmo CPF');

-- ── 2. quem vê ──────────────────────────────────────────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')$$,
  'O histórico de regulação é visto pelo médico e pelo gestor', 'enfermagem não vê');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha($$SELECT public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')$$,
  'O histórico de regulação é visto pelo médico e pelo gestor', 'médico de outra unidade não consulta paciente do hospital');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')) = 2, 'gestor do hospital vê');

-- ── 3. detalhe registra o acesso na unidade do pedido ───────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok((public.regulacao_historico_detalhe('23000000-0000-4000-8000-0000000009b2', '2a000000-0000-4000-8000-0000000009b1')->>'quadro_clinico') LIKE '%UPA%',
  'detalhe do pedido da UPA, com o quadro clínico');
SELECT pg_temp.ok(pg_temp.acessos('21000000-0000-4000-8000-0000000009b1') = 1 AND pg_temp.acessos('21000000-0000-4000-8000-0000000009b2') = 0,
  'o acesso fica registrado na UPA, unidade do pedido');
SELECT pg_temp.ok((public.regulacao_historico_detalhe('23000000-0000-4000-8000-0000000009b2', '2a000000-0000-4000-8000-0000000009b2')->'eventos') IS NOT NULL
              AND pg_temp.acessos('21000000-0000-4000-8000-0000000009b2') = 1, 'pedido do próprio hospital também registra');
SELECT pg_temp.falha($$SELECT public.regulacao_historico_detalhe('23000000-0000-4000-8000-0000000009b2', '2a000000-0000-4000-8000-0000000009b3')$$,
  'Solicitação não encontrada para este paciente', 'não abre pedido de outra pessoa pelo prontuário da Joana');

-- ── 4. cadastro unificado ───────────────────────────────────────────────────
RESET ROLE;
UPDATE public.pacientes SET cpf = NULL, unificado_em = '23000000-0000-4000-8000-0000000009b2', ativo = false
 WHERE id = '23000000-0000-4000-8000-0000000009b3';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000006');
SELECT pg_temp.ok(jsonb_array_length(public.regulacao_historico_paciente('23000000-0000-4000-8000-0000000009b2')) = 3,
  'cadastro unificado: o pedido do cadastro absorvido entra no histórico');

ROLLBACK;
