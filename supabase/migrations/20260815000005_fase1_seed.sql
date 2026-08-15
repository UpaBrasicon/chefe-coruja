-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1 — Seed de desenvolvimento
-- 1 organização, 2 unidades (UPA + hospital), 4 setores, 30 leitos.
--
-- USUÁRIOS não são criados aqui (dependem de auth.users). Passo a passo:
--   1. Crie as contas pelo app (Cadastro) ou no dashboard do Supabase.
--   2. Vincule os papéis via SQL abaixo (troque os e-mails pelos reais).
--   3. Para o dono da plataforma:
--        INSERT INTO public.super_admins (perfil_id)
--        SELECT id FROM public.perfis WHERE email = 'seu@email.com';
--
-- Exemplo de vínculos de teste (admin / gestor / plantonista):
--   INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
--   SELECT p.id, '00000000-0000-0000-0000-000000000101', 'admin',
--          (SELECT id FROM public.perfis WHERE email = 'seu@email.com')
--   FROM public.perfis p WHERE p.email = 'admin@teste.com';
--
--   INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
--   SELECT p.id, '00000000-0000-0000-0000-000000000101', 'gestor',
--          (SELECT id FROM public.perfis WHERE email = 'seu@email.com')
--   FROM public.perfis p WHERE p.email = 'gestor@teste.com';
--
--   INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
--   SELECT p.id, '00000000-0000-0000-0000-000000000101', 'plantonista',
--          (SELECT id FROM public.perfis WHERE email = 'seu@email.com')
--   FROM public.perfis p WHERE p.email = 'plantonista@teste.com';
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.organizacoes (id, nome, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'Rede Saúde Teste', '00.000.000/0001-00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'UPA Centro', 'upa', '1234567', 'São Paulo', 'SP'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Hospital Regional', 'hospital', '7654321', 'São Paulo', 'SP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem)
VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Emergência', 'emergencia', 1),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'Observação', 'observacao', 2),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000102', 'Emergência', 'emergencia', 1),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000102', 'Internação', 'internacao', 2)
ON CONFLICT (id) DO NOTHING;

-- UPA Centro — Emergência: 10 leitos clínicos (ENF-01..ENF-10)
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT '00000000-0000-0000-0000-000000000201', 'ENF-' || lpad(i::text, 2, '0'), 'clinico'
FROM generate_series(1, 10) AS i
ON CONFLICT (setor_id, identificador) DO NOTHING;

-- UPA Centro — Observação: 6 leitos de observação (OBS-01..OBS-06)
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT '00000000-0000-0000-0000-000000000202', 'OBS-' || lpad(i::text, 2, '0'), 'observacao'
FROM generate_series(1, 6) AS i
ON CONFLICT (setor_id, identificador) DO NOTHING;

-- Hospital Regional — Emergência: 8 leitos clínicos (HE-01..HE-08)
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT '00000000-0000-0000-0000-000000000203', 'HE-' || lpad(i::text, 2, '0'), 'clinico'
FROM generate_series(1, 8) AS i
ON CONFLICT (setor_id, identificador) DO NOTHING;

-- Hospital Regional — Internação: 6 leitos clínicos (IN-01..IN-06)
INSERT INTO public.leitos (setor_id, identificador, tipo)
SELECT '00000000-0000-0000-0000-000000000204', 'IN-' || lpad(i::text, 2, '0'), 'clinico'
FROM generate_series(1, 6) AS i
ON CONFLICT (setor_id, identificador) DO NOTHING;
