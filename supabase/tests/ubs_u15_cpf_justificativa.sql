-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000026_ubs_u15_cpf_justificativa.sql (Percurso da
-- UBS, U15, vacina, PR 2). Tudo em transação com ROLLBACK; o cenário é criado
-- aqui.
--
-- 1. a lista do LEDI: 12 motivos;
-- 2. a ficha da UBS grava o motivo; motivo fora da lista é recusado; a ficha
--    sem CPF e sem motivo abre (quem pede é a tela);
-- 3. CPF válido apaga o motivo;
-- 4. "Endereço e dados do SUS" lê e grava o motivo;
-- 5. a carga do LEDI: CPF sozinho; sem CPF, CNS e motivo; sem motivo ou sem
--    CNS, retido.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',  '00000000-0000-4000-8000-0000000115a1'),
  ('ubs',  '00000000-0000-4000-8000-0000000115a2'),
  ('cons', '00000000-0000-4000-8000-0000000115a3'),
  ('rec',  '00000000-0000-4000-8000-0000000115b1');
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
CREATE TEMP TABLE v (nome text PRIMARY KEY, r jsonb) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.pac(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT (r ->> 'paciente_id')::uuid FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.pac(text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u15cpf.local' FROM ids WHERE nome = 'rec';
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome = 'rec'
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U15 CPF');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U15 CPF', 'ubs');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES (pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id('rec'), private.data_atual(), 'manha', now() - interval '1 hour', 360);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

-- ── 1. lista ────────────────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM terminologia.ledi_justificativa_sem_cpf) = 12, '1. 12 motivos do LEDI');
SELECT pg_temp.ok((SELECT nome FROM terminologia.ledi_justificativa_sem_cpf WHERE codigo = 3) = 'Recém-nascidos', '1. 3 = recém-nascidos');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM terminologia.ledi_justificativa_sem_cpf WHERE codigo = 1), '1. o LEDI não tem o código 1');

-- ── 2. ficha da UBS ─────────────────────────────────────────────────────────
SELECT pg_temp.como('rec');
INSERT INTO v SELECT 'rua', public.registrar_ficha(pg_temp.id('cons'), 'Tosse', NULL,
  '{"nome":"Paciente Sem CPF","data_nascimento":"1975-05-05","cns":"898000000000002","cpf_justificativa":"5","tipo_atendimento":"consulta_no_dia"}');
SELECT pg_temp.ok((SELECT cpf_justificativa = 5 FROM public.pacientes WHERE id = pg_temp.pac('rua')), '2. a ficha grava o motivo');
SELECT pg_temp.falha($$SELECT public.registrar_ficha(pg_temp.id('cons'), 'Febre', NULL,
  '{"nome":"Paciente Motivo Errado","data_nascimento":"1976-06-06","cpf_justificativa":"1","tipo_atendimento":"consulta_no_dia"}')$$,
  'Motivo de não ter CPF fora da lista', '2. motivo fora da lista é recusado');
INSERT INTO v SELECT 'nada', public.registrar_ficha(pg_temp.id('cons'), 'Dor', NULL,
  '{"nome":"Paciente Sem Nada","data_nascimento":"1977-07-07","tipo_atendimento":"consulta_no_dia"}');
SELECT pg_temp.ok((SELECT cpf_justificativa IS NULL AND cpf IS NULL FROM public.pacientes WHERE id = pg_temp.pac('nada')),
  '2. sem CPF e sem motivo a ficha abre (o atendimento não espera documento)');

-- ── 5. carga do LEDI (antes do CPF) ─────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.ok((SELECT j @> '{"cns": "898000000000002", "justificativa_sem_cpf": 5}' AND j ->> 'cpf' IS NULL
                     FROM (SELECT private.ledi_carga_cidadao(pg_temp.pac('rua')) AS j) x),
  '5. sem CPF: a carga leva o CNS e o motivo');
DO $$ BEGIN
  PERFORM private.ledi_carga_cidadao(pg_temp.pac('nada'));
  RAISE EXCEPTION 'FALHOU: 5. sem CPF e sem motivo — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'retido: paciente sem CPF e sem justificativa%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  5. sem CPF e sem motivo, retido';
END $$;
UPDATE public.pacientes SET cpf_justificativa = 8 WHERE id = pg_temp.pac('nada');
DO $$ BEGIN
  PERFORM private.ledi_carga_cidadao(pg_temp.pac('nada'));
  RAISE EXCEPTION 'FALHOU: 5. sem CPF e sem CNS — passou sem erro';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'retido: paciente sem CPF e sem CNS%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  5. sem CPF, com motivo e sem CNS, retido';
END $$;

-- ── 4. Endereço e dados do SUS ──────────────────────────────────────────────
SELECT pg_temp.como('rec');
SELECT pg_temp.ok((SELECT j @> '{"tem_cpf": false, "cpf_justificativa": 5}' FROM (SELECT public.endereco_sus(pg_temp.pac('rua')) AS j) x),
  '4. endereco_sus mostra que não tem CPF e o motivo');
SELECT public.salvar_endereco_sus(pg_temp.pac('rua'), '{"cpf_justificativa": "10"}');
SELECT pg_temp.ok((SELECT cpf_justificativa = 10 FROM public.pacientes WHERE id = pg_temp.pac('rua')), '4. o motivo se corrige depois');
SELECT pg_temp.falha($$SELECT public.salvar_endereco_sus(pg_temp.pac('rua'), '{"cpf_justificativa": "99"}')$$,
  'Motivo de não ter CPF fora da lista', '4. motivo fora da lista é recusado');

-- ── 3. CPF apaga o motivo ───────────────────────────────────────────────────
RESET ROLE;
UPDATE public.pacientes SET cpf = '52998224725' WHERE id = pg_temp.pac('rua');
SELECT pg_temp.ok((SELECT cpf_justificativa IS NULL FROM public.pacientes WHERE id = pg_temp.pac('rua')), '3. CPF válido apaga o motivo');
SELECT pg_temp.ok((SELECT j ->> 'cpf' = '52998224725' AND j -> 'justificativa_sem_cpf' = 'null'::jsonb
                     FROM (SELECT private.ledi_carga_cidadao(pg_temp.pac('rua')) AS j) x),
  '5. com CPF, a carga leva só o CPF');
SELECT pg_temp.ok((SELECT j @> '{"tem_cpf": true}' FROM (SELECT public.endereco_sus(pg_temp.pac('rua')) AS j) x),
  '4. endereco_sus vê o CPF');

ROLLBACK;
