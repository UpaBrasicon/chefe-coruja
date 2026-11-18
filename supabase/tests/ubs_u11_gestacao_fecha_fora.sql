-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000015_ubs_u11_gestacao_fecha_fora.sql (percurso
-- da UBS, U11, PR 2). Tudo em transação com ROLLBACK; o cenário é criado aqui.
--
-- 1. o RN cadastrado no hospital, ligado à mãe, fecha a gestação da UBS como
--    parto (a mãe é achada pelo CPF);
-- 2. o desfecho da porta da UPA com CID de aborto fecha como aborto; CID que não
--    é de parto nem aborto não mexe;
-- 3. sem CPF, CNS nem unificação, a gestação da UBS fica aberta.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000092a1'),
  ('ubs',   '00000000-0000-4000-8000-0000000092a2'),
  ('upa',   '00000000-0000-4000-8000-0000000092a3'),
  ('cons',  '00000000-0000-4000-8000-0000000092a4'),
  ('porta', '00000000-0000-4000-8000-0000000092a5'),
  ('prof',  '00000000-0000-4000-8000-0000000092b1'),
  ('m1_ubs','00000000-0000-4000-8000-0000000092c1'),
  ('m1_upa','00000000-0000-4000-8000-0000000092c2'),
  ('m2_ubs','00000000-0000-4000-8000-0000000092c3'),
  ('m2_upa','00000000-0000-4000-8000-0000000092c4'),
  ('m3_ubs','00000000-0000-4000-8000-0000000092c5'),
  ('m3_upa','00000000-0000-4000-8000-0000000092c6');
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
CREATE FUNCTION pg_temp.desfecho(p text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(desfecho, 'aberta') FROM public.pre_natal_gestacoes WHERE paciente_id = pg_temp.id(p) $$;

INSERT INTO auth.users (id, email) VALUES (pg_temp.id('prof'), 'prof@u11b.local');
INSERT INTO public.perfis (id, nome_completo) VALUES (pg_temp.id('prof'), 'Profissional U11')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do U11 PR2');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do U11 PR2', 'ubs'),
  (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do U11 PR2', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('cons'), pg_temp.id('ubs'), 'Consultório 1', 'consultorio'),
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Porta', 'emergencia');

-- a mesma mulher na UBS e na UPA: 1 e 2 pelo CPF; 3 sem documento
INSERT INTO public.pacientes (id, unidade_id, nome, prontuario, sexo, data_nascimento, cpf) VALUES
  (pg_temp.id('m1_ubs'), pg_temp.id('ubs'), 'Mulher Um', 'U11B-1', 'F', '1994-01-01', '52998224725'),
  (pg_temp.id('m1_upa'), pg_temp.id('upa'), 'Mulher Um', 'U11B-2', 'F', '1994-01-01', '52998224725'),
  (pg_temp.id('m2_ubs'), pg_temp.id('ubs'), 'Mulher Dois', 'U11B-3', 'F', '1996-02-02', '11144477735'),
  (pg_temp.id('m2_upa'), pg_temp.id('upa'), 'Mulher Dois', 'U11B-4', 'F', '1996-02-02', '11144477735'),
  (pg_temp.id('m3_ubs'), pg_temp.id('ubs'), 'Mulher Tres', 'U11B-5', 'F', '1998-03-03', NULL),
  (pg_temp.id('m3_upa'), pg_temp.id('upa'), 'Mulher Tres', 'U11B-6', 'F', '1998-03-03', NULL);
INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, dum, entrada_por)
SELECT pg_temp.id('ubs'), pg_temp.id(p), 'manual', private.data_atual() - d, pg_temp.id('prof')
  FROM (VALUES ('m1_ubs', 260), ('m2_ubs', 60), ('m3_ubs', 270)) x(p, d);

-- ── 1. RN no hospital ───────────────────────────────────────────────────────
INSERT INTO public.pacientes (unidade_id, nome, prontuario, sexo, data_nascimento, mae_id)
VALUES (pg_temp.id('upa'), 'RN de Mulher Um', 'U11B-7', 'M', private.data_atual(), pg_temp.id('m1_upa'));
SELECT pg_temp.ok(pg_temp.desfecho('m1_ubs') = 'parto'
                  AND (SELECT desfecho_em = private.data_atual() FROM public.pre_natal_gestacoes WHERE paciente_id = pg_temp.id('m1_ubs')),
  '1. o RN cadastrado na UPA fecha a gestação da UBS como parto, na data do nascimento');

-- ── 2. desfecho da porta ────────────────────────────────────────────────────
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa) VALUES
  ('00000000-0000-4000-8000-0000000092d1', pg_temp.id('upa'), pg_temp.id('m2_upa'), pg_temp.id('porta'), 'Sangramento', pg_temp.id('prof'), 'atendimento'),
  ('00000000-0000-4000-8000-0000000092d2', pg_temp.id('upa'), pg_temp.id('m3_upa'), pg_temp.id('porta'), 'Cefaleia', pg_temp.id('prof'), 'atendimento');
ALTER TABLE public.episodios DISABLE TRIGGER trg_desfecho_confere_pendencias;
ALTER TABLE public.episodios DISABLE TRIGGER trg_desfecho_confere_medicacao;
-- CID que não é de parto nem aborto não mexe
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now(), desfecho_detalhes = '{"cid_alta":"R51"}'
 WHERE id = '00000000-0000-4000-8000-0000000092d2';
UPDATE public.episodios SET etapa = 'encerrado', encerrado_em = now(), desfecho_detalhes = '{"cid_alta":"O03.9"}'
 WHERE id = '00000000-0000-4000-8000-0000000092d1';
SELECT pg_temp.ok(pg_temp.desfecho('m2_ubs') = 'aborto', '2. o desfecho da UPA com CID O03.9 fecha a gestação da UBS como aborto');

-- ── 3. sem documento ────────────────────────────────────────────────────────
INSERT INTO public.pacientes (unidade_id, nome, prontuario, sexo, data_nascimento, mae_id)
VALUES (pg_temp.id('upa'), 'RN de Mulher Tres', 'U11B-8', 'F', private.data_atual(), pg_temp.id('m3_upa'));
SELECT pg_temp.ok(pg_temp.desfecho('m3_ubs') = 'aberta', '3. sem CPF, CNS nem unificação, a gestação da UBS fica aberta (e o R51 não mexeu)');

SELECT pg_temp.ok(private.desfecho_pelo_cid('O80') = 'parto' AND private.desfecho_pelo_cid('o84.9') = 'parto'
                  AND private.desfecho_pelo_cid('O00.1') = 'aborto' AND private.desfecho_pelo_cid('O09') IS NULL
                  AND private.desfecho_pelo_cid('O85') IS NULL,
  '2. CID O80–O84 é parto, O00–O08 é aborto, os outros não');

ROLLBACK;
