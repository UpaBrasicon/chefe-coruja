-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270421000071_mapa_vagas_consulta_medico.sql.
-- Tudo em transação com ROLLBACK. O cenário é criado aqui.
--
-- 1. o médico e o NIR da unidade leem o mapa, com so_consulta e sem editar;
-- 2. o mapa não traz o nome do paciente que ocupa o leito;
-- 3. o gestor continua editando a própria unidade, sem so_consulta;
-- 4. o enfermeiro da unidade e o médico de outra rede são recusados.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000007e1001'),
  ('org2', '00000000-0000-4000-8000-0000007e1002'),
  ('hosp', '00000000-0000-4000-8000-0000007e1003'),
  ('upa2', '00000000-0000-4000-8000-0000007e1004'),
  ('uti',  '00000000-0000-4000-8000-0000007e1011'),
  ('pac',  '00000000-0000-4000-8000-0000007e1021'),
  ('gest', '00000000-0000-4000-8000-0000007e1031'),
  ('med',  '00000000-0000-4000-8000-0000007e1032'),
  ('nir',  '00000000-0000-4000-8000-0000007e1033'),
  ('enf',  '00000000-0000-4000-8000-0000007e1034'),
  ('fora', '00000000-0000-4000-8000-0000007e1035');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE FUNCTION pg_temp.recusa(p_unidade text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN PERFORM public.regulacao_mapa_vagas(pg_temp.id(p_unidade));
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % (passou sem erro)', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.recusa(text, text) TO authenticated;
CREATE FUNCTION pg_temp.mapa() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.regulacao_mapa_vagas(pg_temp.id('hosp')) $$;
GRANT EXECUTE ON FUNCTION pg_temp.mapa() TO authenticated;
CREATE FUNCTION pg_temp.hosp(m jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT u FROM jsonb_array_elements(m->'unidades') u WHERE (u->>'id')::uuid = pg_temp.id('hosp') $$;
GRANT EXECUTE ON FUNCTION pg_temp.hosp(jsonb) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@revisao-mapa.local' FROM ids WHERE nome IN ('gest', 'med', 'nir', 'enf', 'fora');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('gest', 'med', 'nir', 'enf', 'fora')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do mapa da revisão'), (pg_temp.id('org2'), 'Outra rede do mapa');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('hosp'), pg_temp.id('org'), 'Hospital do mapa da revisão', 'hospital'),
  (pg_temp.id('upa2'), pg_temp.id('org2'), 'UPA da outra rede', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo, regulacao_tipo_leito)
VALUES (pg_temp.id('uti'), pg_temp.id('hosp'), 'UTI', 'internacao', 'uti_adulto');
INSERT INTO public.leitos (setor_id, identificador, status) VALUES
  (pg_temp.id('uti'), 'UTI-1', 'livre'), (pg_temp.id('uti'), 'UTI-2', 'ocupado');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento)
VALUES (pg_temp.id('pac'), pg_temp.id('hosp'), 'Paciente Secreto do Mapa', '1960-01-01');
INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao, status, setor_atual_id, leito_atual_id, data_entrada_setor)
SELECT pg_temp.id('org'), pg_temp.id('hosp'), pg_temp.id('pac'), 'urgencia', 'emergencia', 'internado', pg_temp.id('uti'), l.id, now()
  FROM public.leitos l WHERE l.setor_id = pg_temp.id('uti') AND l.identificador = 'UTI-2';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('gest'), pg_temp.id('hosp'), 'gestor'),
  (pg_temp.id('med'), pg_temp.id('hosp'), 'plantonista'),
  (pg_temp.id('nir'), pg_temp.id('hosp'), 'nir'),
  (pg_temp.id('enf'), pg_temp.id('hosp'), 'enfermeiro'),
  (pg_temp.id('fora'), pg_temp.id('upa2'), 'plantonista');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');
SELECT pg_temp.ok((pg_temp.mapa()->>'so_consulta')::boolean
              AND NOT (pg_temp.hosp(pg_temp.mapa())->>'editavel')::boolean
              AND (pg_temp.hosp(pg_temp.mapa())->'leitos'->0->>'ocupado')::int = 1,
  'médico lê o mapa da unidade, só consulta');
SELECT pg_temp.ok(pg_temp.mapa()::text NOT ILIKE '%Secreto%' AND pg_temp.mapa()::text NOT ILIKE '%paciente%',
  'o mapa não traz dado de paciente');
SELECT pg_temp.como('nir');
SELECT pg_temp.ok((pg_temp.mapa()->>'so_consulta')::boolean AND NOT (pg_temp.hosp(pg_temp.mapa())->>'editavel')::boolean,
  'NIR lê o mapa, só consulta');
SELECT pg_temp.como('gest');
SELECT pg_temp.ok(NOT (pg_temp.mapa()->>'so_consulta')::boolean AND (pg_temp.hosp(pg_temp.mapa())->>'editavel')::boolean,
  'gestor continua editando a própria unidade');
SELECT pg_temp.como('enf');
SELECT pg_temp.recusa('hosp', 'enfermeiro da unidade: recusado');
SELECT pg_temp.como('fora');
SELECT pg_temp.recusa('hosp', 'médico de outra rede: recusado');
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.regulacao_mapa_vagas(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE NOTICE 'OK  fora do anon';
END $$;
ROLLBACK;
