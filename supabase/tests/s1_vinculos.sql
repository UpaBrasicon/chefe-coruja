-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S1: vínculos e perfis entre organizações
-- (migrations 20270414000055 expand e 20270414000056 contract).
-- 1. O admin da rede A não lê perfil de fora da rede A (sem vínculo nem adesão
--    a contrato dela); lê o histórico da própria rede e quem aderiu ao contrato.
-- 2. O admin não grava direto em `vinculos`; revoga e reativa pelas RPCs, só na
--    própria organização.
-- 3. concluir_adesao: só na organização do contrato, com o papel do contrato.
-- 4. zerar_segundo_fator falha para quem não tem vínculo legítimo com o autor.
-- Tudo em transação com ROLLBACK, sem depender do seed.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('orga',    '00000000-0000-4000-8000-0000000051a1'),
  ('orgb',    '00000000-0000-4000-8000-0000000051a2'),
  ('unia',    '00000000-0000-4000-8000-0000000051a3'),
  ('unia2',   '00000000-0000-4000-8000-0000000051a4'),
  ('unib',    '00000000-0000-4000-8000-0000000051a5'),
  ('adma',    '00000000-0000-4000-8000-0000000051b1'),
  ('admb',    '00000000-0000-4000-8000-0000000051b2'),
  ('pessoab', '00000000-0000-4000-8000-0000000051b3'),
  ('solto',   '00000000-0000-4000-8000-0000000051b4'),
  ('aderiu',  '00000000-0000-4000-8000-0000000051b5'),
  ('antigo',  '00000000-0000-4000-8000-0000000051b6'),
  ('contra',  '00000000-0000-4000-8000-0000000051c1'),
  ('adesao',  '00000000-0000-4000-8000-0000000051c2'),
  ('v_ant',   '00000000-0000-4000-8000-0000000051d1'),
  ('v_pb',    '00000000-0000-4000-8000-0000000051d2');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
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
-- leitura do estado real (fora da RLS) para conferir o efeito
CREATE FUNCTION pg_temp.ativo(p text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT ativo FROM public.vinculos WHERE id = (SELECT id FROM ids WHERE nome = p) $$;
GRANT EXECUTE ON FUNCTION pg_temp.ativo(text) TO authenticated;
CREATE FUNCTION pg_temp.tem_vinculo(p_perfil text, p_unidade text, p_papel text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos WHERE perfil_id = (SELECT id FROM ids WHERE nome = p_perfil)
                  AND unidade_id = (SELECT id FROM ids WHERE nome = p_unidade) AND papel::text = p_papel AND ativo) $$;
GRANT EXECUTE ON FUNCTION pg_temp.tem_vinculo(text, text, text) TO authenticated;

INSERT INTO auth.users (id, email)
SELECT id, nome || '@s1.local' FROM ids WHERE nome IN ('adma', 'admb', 'pessoab', 'solto', 'aderiu', 'antigo');
INSERT INTO public.perfis (id, nome_completo)
SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('adma', 'admb', 'pessoab', 'solto', 'aderiu', 'antigo')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('orga'), 'Rede A do S1'), (pg_temp.id('orgb'), 'Rede B do S1');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  (pg_temp.id('unia'),  pg_temp.id('orga'), 'UPA A do S1', 'upa'),
  (pg_temp.id('unia2'), pg_temp.id('orga'), 'UPA A2 do S1', 'upa'),
  (pg_temp.id('unib'),  pg_temp.id('orgb'), 'UPA B do S1', 'upa');
INSERT INTO public.vinculos (id, perfil_id, unidade_id, papel, ativo) VALUES
  (gen_random_uuid(),     pg_temp.id('adma'),    pg_temp.id('unia'), 'admin', true),
  (gen_random_uuid(),     pg_temp.id('admb'),    pg_temp.id('unib'), 'admin', true),
  (pg_temp.id('v_pb'),    pg_temp.id('pessoab'), pg_temp.id('unib'), 'plantonista', true),
  (pg_temp.id('v_ant'),   pg_temp.id('antigo'),  pg_temp.id('unia'), 'plantonista', false);
INSERT INTO public.contratos_rede (id, codigo, organizacao_id, papel_padrao)
VALUES (pg_temp.id('contra'), 'CT-2099-951', pg_temp.id('orga'), 'gestor');
INSERT INTO public.adesoes_contrato (id, contrato_id, perfil_id, papel)
VALUES (pg_temp.id('adesao'), pg_temp.id('contra'), pg_temp.id('aderiu'), 'gestor');

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('adma');

-- ── 1. Leitura de perfis ─────────────────────────────────────────────────────
SELECT pg_temp.ok((SELECT count(*) FROM public.perfis WHERE id = pg_temp.id('solto')) = 0,
  'admin da rede A não lê perfil solto de fora (sem vínculo nem adesão)');
SELECT pg_temp.ok((SELECT count(*) FROM public.perfis WHERE id = pg_temp.id('pessoab')) = 0,
  'admin da rede A não lê perfil da rede B');
SELECT pg_temp.ok((SELECT count(*) FROM public.perfis WHERE id = pg_temp.id('aderiu')) = 1,
  'admin da rede A lê quem aderiu ao contrato da rede A');
SELECT pg_temp.ok((SELECT count(*) FROM public.perfis WHERE id = pg_temp.id('antigo')) = 1,
  'admin da rede A lê quem já teve vínculo na rede A (histórico)');

-- ── 2. Escrita direta e RPCs ─────────────────────────────────────────────────
SELECT pg_temp.falha(format($q$INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES (%L, %L, 'plantonista')$q$,
                            pg_temp.id('pessoab'), pg_temp.id('unia')),
  'new row violates row-level security', 'admin não cria vínculo direto na tabela');
UPDATE public.vinculos SET ativo = true WHERE id = pg_temp.id('v_ant');
SELECT pg_temp.ok(pg_temp.ativo('v_ant') IS FALSE, 'admin não reativa direto na tabela');

SELECT public.reativar_vinculo(pg_temp.id('v_ant'));
SELECT pg_temp.ok(pg_temp.ativo('v_ant') IS TRUE, 'admin reativa vínculo da própria rede pela RPC');
SELECT public.revogar_vinculo(pg_temp.id('v_ant'));
SELECT pg_temp.ok(pg_temp.ativo('v_ant') IS FALSE, 'admin revoga vínculo da própria rede pela RPC');
SELECT pg_temp.falha(format('SELECT public.revogar_vinculo(%L)', pg_temp.id('v_pb')),
  'Só o administrador da organização', 'admin da rede A não revoga vínculo da rede B');

-- ── 3. Concluir a entrada pelo contrato ──────────────────────────────────────
SELECT pg_temp.falha(format('SELECT public.concluir_adesao(%L, %L)', pg_temp.id('adesao'), pg_temp.id('unib')),
  'A unidade não é da organização do contrato', 'adesão não entra em unidade de outra rede');
SELECT public.concluir_adesao(pg_temp.id('adesao'), pg_temp.id('unia2'));
SELECT pg_temp.ok(pg_temp.tem_vinculo('aderiu', 'unia2', 'gestor'), 'adesão concluída com o papel do contrato');

SELECT pg_temp.como('admb');
SELECT pg_temp.falha(format('SELECT public.concluir_adesao(%L, %L)', pg_temp.id('adesao'), pg_temp.id('unia')),
  'Só o administrador da organização do contrato', 'admin da rede B não conclui adesão da rede A');

-- ── 4. Zerar o segundo fator ─────────────────────────────────────────────────
SELECT pg_temp.como('adma');
SELECT pg_temp.falha(format('SELECT public.zerar_segundo_fator(%L, %L)', pg_temp.id('pessoab'), 'teste do S1, sem vínculo legítimo'),
  'Só o gestor da unidade da pessoa', 'admin da rede A não zera o 2FA de quem é da rede B');

ROLLBACK;
