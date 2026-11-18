-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000016_ubs_u11_rn_puericultura.sql (percurso da
-- UBS, U11, PR 3; N1 do RT). Tudo em transação com ROLLBACK; o cenário é criado
-- aqui.
--
-- 1. o RN cadastrado na UPA ganha cadastro em segundo plano na UBS da mãe
--    (achada pelo CPF), com a mãe ligada e o aviso para a equipe da UBS;
-- 2. a puericultura mostra o RN com a marca "ainda não veio à UBS" e a mãe; a
--    primeira ficha na UBS tira a marca;
-- 3. a gestação que passou da DPP sem parto vira "bebê esperado"; com o parto
--    registrado, sai.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000093a1'),
  ('ubs',   '00000000-0000-4000-8000-0000000093a2'),
  ('upa',   '00000000-0000-4000-8000-0000000093a3'),
  ('cons',  '00000000-0000-4000-8000-0000000093a4'),
  ('enf',   '00000000-0000-4000-8000-0000000093b1'),
  ('rec',   '00000000-0000-4000-8000-0000000093b2'),
  ('m_ubs', '00000000-0000-4000-8000-0000000093c1'),
  ('m_upa', '00000000-0000-4000-8000-0000000093c2'),
  ('g2',    '00000000-0000-4000-8000-0000000093c3');
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
CREATE TEMP TABLE r (nome text PRIMARY KEY, j jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@u11c.local' FROM ids WHERE nome IN ('enf', 'rec');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('enf', 'rec')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U11 PR3');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U11 PR3', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'Hospital do U11 PR3', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('enf'), pg_temp.id('ubs'), 'enfermeiro'), (pg_temp.id('rec'), pg_temp.id('ubs'), 'recepcao');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('ubs'), pg_temp.id('cons'), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['enf', 'rec']) p;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('ubs') ON CONFLICT DO NOTHING;

INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento, cpf, telefone) VALUES
  (pg_temp.id('m_ubs'), pg_temp.id('ubs'), 'Mae Do Bebe', 'U11C-1', 'F', '1995-05-05', '52998224725', '11999990000'),
  (pg_temp.id('m_upa'), pg_temp.id('upa'), 'Mae Do Bebe', 'U11C-2', 'F', '1995-05-05', '52998224725', NULL),
  (pg_temp.id('g2'),    pg_temp.id('ubs'), 'Gestante Sem Noticia', 'U11C-3', 'F', '1997-07-07', NULL, '11988880000');
INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, dum, entrada_por) VALUES
  (pg_temp.id('ubs'), pg_temp.id('g2'), 'manual', private.data_atual() - 290, pg_temp.id('enf'));

-- ── 1. RN na UPA ────────────────────────────────────────────────────────────
INSERT INTO public.pacientes (unidade_id, nome, prontuario, sexo, data_nascimento, mae_id)
VALUES (pg_temp.id('upa'), 'RN de Mae Do Bebe', 'U11C-4', 'F', private.data_atual() - 2, pg_temp.id('m_upa'));
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.pacientes
                    WHERE unidade_id = pg_temp.id('ubs') AND mae_id = pg_temp.id('m_ubs') AND pre_cadastro
                      AND data_nascimento = private.data_atual() - 2 AND nome = 'RN de Mae Do Bebe'),
  '1. o RN da UPA ganha cadastro em segundo plano na UBS da mãe');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.notificacoes_plantonista WHERE unidade_id = pg_temp.id('ubs')
                            AND perfil_id = pg_temp.id('enf') AND mensagem LIKE 'Nasceu o bebê de Mae Do Bebe%'),
  '1. a enfermagem da UBS recebe o aviso');
-- um segundo cadastro do mesmo RN na UPA não duplica na UBS
INSERT INTO public.pacientes (unidade_id, nome, prontuario, sexo, data_nascimento, mae_id)
VALUES (pg_temp.id('upa'), 'RN de Mae Do Bebe (2)', 'U11C-5', 'F', private.data_atual() - 2, pg_temp.id('m_upa'));
SELECT pg_temp.ok((SELECT count(*) = 1 FROM public.pacientes WHERE unidade_id = pg_temp.id('ubs') AND mae_id = pg_temp.id('m_ubs')),
  '1. o mesmo RN não entra duas vezes na UBS');

-- ── 2. puericultura ─────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
INSERT INTO r SELECT 'p', public.puericultura_painel(pg_temp.id('ubs'));
INSERT INTO r SELECT 'e', public.puericultura_bebes_esperados(pg_temp.id('ubs'));
RESET ROLE;
SELECT pg_temp.ok((SELECT bool_or((x ->> 'pre_cadastro')::boolean AND x -> 'mae' ->> 'telefone' = '11999990000')
                     FROM r, jsonb_array_elements(r.j) x WHERE r.nome = 'p'),
  '2. a puericultura mostra o RN como "ainda não veio" e o telefone da mãe');
SELECT pg_temp.ok((SELECT jsonb_array_length(j) = 1 AND j -> 0 ->> 'nome' = 'Gestante Sem Noticia' FROM r WHERE nome = 'e'),
  '3. a gestação que passou da DPP sem parto vira bebê esperado');

INSERT INTO ids SELECT 'rn_ubs', id FROM public.pacientes WHERE unidade_id = pg_temp.id('ubs') AND mae_id = pg_temp.id('m_ubs');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('rec');
SELECT public.registrar_ficha(pg_temp.id('cons'), 'Primeira consulta do bebê', pg_temp.id('rn_ubs'), '{"tipo_atendimento":"consulta_no_dia"}');
RESET ROLE;
SELECT pg_temp.ok((SELECT NOT pre_cadastro FROM public.pacientes WHERE unidade_id = pg_temp.id('ubs') AND mae_id = pg_temp.id('m_ubs')),
  '2. a primeira ficha na UBS tira a marca');

-- ── 3. com o parto registrado, o bebê esperado sai ──────────────────────────
UPDATE public.pre_natal_gestacoes SET desfecho = 'parto', desfecho_em = private.data_atual() - 5, desfecho_registrado_em = now()
 WHERE paciente_id = pg_temp.id('g2');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.ok(jsonb_array_length(public.puericultura_bebes_esperados(pg_temp.id('ubs'))) = 0,
  '3. com o parto registrado, o bebê esperado sai');
RESET ROLE;

ROLLBACK;
