-- ════════════════════════════════════════════════════════════════════════════
-- Portão da Fase 5 (BACKLOG, decisões K1 a K3 do RT em 03/11/2026) — rede de
-- teste nova, isolada das rodadas anteriores.
--
-- Organização própria ("Rede E2E Fase 5"), CNES fictícios: a UBS, a UPA de
-- referência, o hospital e a Central de Regulação; setores e leitos; uma conta
-- por papel; escala de ontem a depois de amanhã nos três turnos.
--
-- Uso (ambiente local ou homologação; NUNCA produção):
--   psql ... -v senha='<senha de teste>' -f scripts/e2e/40_rede_fase5.sql
--   ou, na homologação: HASH_E2E=<hash> node scripts/e2e/homolog/preparar.mjs ...
-- A senha não fica aqui: na homologação ela vive só em scripts/e2e/.senha-e2e
-- (fora do git) e o banco recebe o hash. Repetível (ON CONFLICT / NOT EXISTS).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
BEGIN;

-- ── organização e unidades ──────────────────────────────────────────────────
INSERT INTO public.organizacoes (id, nome) VALUES ('f5000000-0000-4000-8000-000000000001', 'Rede E2E Fase 5')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf) VALUES
  ('f5100000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'UBS Fase 5',                 'ubs',      '9995011', 'Cidade Teste', 'SP'),
  ('f5100000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 'UPA Fase 5 24h',             'upa',      '9995028', 'Cidade Teste', 'SP'),
  ('f5100000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001', 'Hospital Fase 5',            'hospital', '9995036', 'Cidade Teste', 'SP'),
  ('f5100000-0000-4000-8000-000000000009', 'f5000000-0000-4000-8000-000000000001', 'Central de Regulação Fase 5', 'upa',     NULL,      'Cidade Teste', 'SP')
ON CONFLICT (id) DO NOTHING;
UPDATE public.unidades SET protocolo_classificacao_id = (SELECT id FROM public.protocolos_classificacao ORDER BY codigo LIMIT 1)
 WHERE id IN ('f5100000-0000-4000-8000-000000000002', 'f5100000-0000-4000-8000-000000000003') AND protocolo_classificacao_id IS NULL;

-- ── contas de teste (uma por papel) ─────────────────────────────────────────
CREATE TEMP TABLE f5_contas (id uuid, email text, nome text, crm text) ON COMMIT DROP;
INSERT INTO f5_contas VALUES
  ('f5200000-0000-4000-8000-000000000001', 'recepcao.ubs.f5@teste.local',    'Recepção UBS F5',          NULL),
  ('f5200000-0000-4000-8000-000000000002', 'enfermeiro.ubs.f5@teste.local',  'Enfermeira UBS F5',        NULL),
  ('f5200000-0000-4000-8000-000000000003', 'tecnico.ubs.f5@teste.local',     'Técnico UBS F5',           NULL),
  ('f5200000-0000-4000-8000-000000000004', 'medico.ubs.f5@teste.local',      'Médica UBS F5',            '950004'),
  ('f5200000-0000-4000-8000-000000000005', 'gestor.ubs.f5@teste.local',      'Gestor UBS F5',            NULL),
  ('f5200000-0000-4000-8000-000000000006', 'recepcao.upa.f5@teste.local',    'Recepção UPA F5',          NULL),
  ('f5200000-0000-4000-8000-000000000007', 'enfermeiro.upa.f5@teste.local',  'Enfermeiro UPA F5',        NULL),
  ('f5200000-0000-4000-8000-000000000008', 'medico.upa.f5@teste.local',      'Médico UPA F5',            '950008'),
  ('f5200000-0000-4000-8000-000000000009', 'gestor.upa.f5@teste.local',      'Gestora UPA F5',           NULL),
  ('f5200000-0000-4000-8000-000000000010', 'faturamento.f5@teste.local',     'Faturamento F5',           NULL),
  ('f5200000-0000-4000-8000-000000000011', 'medico.hospital.f5@teste.local', 'Médico do Hospital F5',    '950011'),
  ('f5200000-0000-4000-8000-000000000012', 'regulador.f5@teste.local',       'Reguladora F5',            '950012'),
  ('f5200000-0000-4000-8000-000000000013', 'nir.f5@teste.local',             'NIR F5',                   NULL),
  ('f5200000-0000-4000-8000-000000000014', 'farmaceutico.f5@teste.local',    'Farmacêutico F5',          NULL),
  ('f5200000-0000-4000-8000-000000000015', 'medico.internacao.f5@teste.local', 'Médica da Internação F5', '950015');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email, crypt(:'senha', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM f5_contas c
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.id::text, json_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
  FROM f5_contas c WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = c.id);
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email FROM f5_contas c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
SELECT 'f5000000-0000-4000-8000-000000000001', 'f5100000-0000-4000-8000-000000000009', 'f5200000-0000-4000-8000-000000000009'
WHERE NOT EXISTS (SELECT 1 FROM public.centrais_regulacao WHERE organizacao_id = 'f5000000-0000-4000-8000-000000000001');

-- ── setores e leitos ────────────────────────────────────────────────────────
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico, regulacao_tipo_leito) VALUES
  ('f5300000-0000-4000-8000-000000000001', 'f5100000-0000-4000-8000-000000000001', 'Consultório 1',     'consultorio', 1, 'todos',  NULL),
  ('f5300000-0000-4000-8000-000000000011', 'f5100000-0000-4000-8000-000000000002', 'Pronto Socorro',    'emergencia',  1, 'todos',  NULL),
  ('f5300000-0000-4000-8000-000000000012', 'f5100000-0000-4000-8000-000000000002', 'Observação Adulto', 'observacao',  2, 'adulto', NULL),
  ('f5300000-0000-4000-8000-000000000013', 'f5100000-0000-4000-8000-000000000002', 'Internação',        'internacao',  3, 'todos',  NULL),
  ('f5300000-0000-4000-8000-000000000021', 'f5100000-0000-4000-8000-000000000003', 'Clínica Médica',    'internacao',  1, 'adulto', 'clinico'),
  ('f5300000-0000-4000-8000-000000000091', 'f5100000-0000-4000-8000-000000000009', 'Regulação',         'outro',       1, 'todos',  NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT s.id, x.prefixo || '-' || lpad(n::text, 2, '0'), x.tipo::public.tipo_leito, 'livre'
  FROM (VALUES ('f5300000-0000-4000-8000-000000000011'::uuid, 'PS', 'clinico', 4), ('f5300000-0000-4000-8000-000000000012'::uuid, 'OA', 'observacao', 4),
               ('f5300000-0000-4000-8000-000000000013'::uuid, 'INT', 'clinico', 4), ('f5300000-0000-4000-8000-000000000021'::uuid, 'CM', 'clinico', 4)) x(setor, prefixo, tipo, qtd)
  JOIN public.setores s ON s.id = x.setor, generate_series(1, x.qtd) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.id);

-- ── vínculos ────────────────────────────────────────────────────────────────
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT v.perfil::uuid, v.unidade::uuid, v.papel::public.papel
  FROM (VALUES
    ('f5200000-0000-4000-8000-000000000001', 'f5100000-0000-4000-8000-000000000001', 'recepcao'),
    ('f5200000-0000-4000-8000-000000000002', 'f5100000-0000-4000-8000-000000000001', 'enfermeiro'),
    ('f5200000-0000-4000-8000-000000000003', 'f5100000-0000-4000-8000-000000000001', 'tecnico_enfermagem'),
    ('f5200000-0000-4000-8000-000000000004', 'f5100000-0000-4000-8000-000000000001', 'plantonista'),
    ('f5200000-0000-4000-8000-000000000005', 'f5100000-0000-4000-8000-000000000001', 'gestor'),
    ('f5200000-0000-4000-8000-000000000006', 'f5100000-0000-4000-8000-000000000002', 'recepcao'),
    ('f5200000-0000-4000-8000-000000000007', 'f5100000-0000-4000-8000-000000000002', 'enfermeiro'),
    ('f5200000-0000-4000-8000-000000000008', 'f5100000-0000-4000-8000-000000000002', 'plantonista'),
    ('f5200000-0000-4000-8000-000000000009', 'f5100000-0000-4000-8000-000000000002', 'gestor'),
    ('f5200000-0000-4000-8000-000000000009', 'f5100000-0000-4000-8000-000000000009', 'gestor'),
    ('f5200000-0000-4000-8000-000000000010', 'f5100000-0000-4000-8000-000000000002', 'faturamento'),
    ('f5200000-0000-4000-8000-000000000011', 'f5100000-0000-4000-8000-000000000003', 'plantonista'),
    ('f5200000-0000-4000-8000-000000000012', 'f5100000-0000-4000-8000-000000000009', 'regulador'),
    ('f5200000-0000-4000-8000-000000000013', 'f5100000-0000-4000-8000-000000000002', 'nir'),
    ('f5200000-0000-4000-8000-000000000014', 'f5100000-0000-4000-8000-000000000002', 'farmaceutico'),
    ('f5200000-0000-4000-8000-000000000015', 'f5100000-0000-4000-8000-000000000002', 'plantonista')) v(perfil, unidade, papel)
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = v.perfil::uuid AND x.unidade_id = v.unidade::uuid AND x.papel = v.papel::public.papel);

-- ── escala: ontem a depois de amanhã, nos três turnos ───────────────────────
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT e.unidade::uuid, e.setor::uuid, e.perfil::uuid, d::date, t
  FROM (VALUES
    ('f5100000-0000-4000-8000-000000000001', 'f5300000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000001'),
    ('f5100000-0000-4000-8000-000000000001', 'f5300000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000002'),
    ('f5100000-0000-4000-8000-000000000001', 'f5300000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000003'),
    ('f5100000-0000-4000-8000-000000000001', 'f5300000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000004'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000006'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000007'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000008'),
    -- uma pessoa por setor no mesmo horário (a escala recusa sobreposição)
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000013', 'f5200000-0000-4000-8000-000000000015'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000013'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000014'),
    ('f5100000-0000-4000-8000-000000000003', 'f5300000-0000-4000-8000-000000000021', 'f5200000-0000-4000-8000-000000000011'),
    ('f5100000-0000-4000-8000-000000000009', 'f5300000-0000-4000-8000-000000000091', 'f5200000-0000-4000-8000-000000000012')) e(unidade, setor, perfil),
       generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 2, interval '1 day') d,
       unnest(ARRAY['manha', 'tarde', 'noite']) t
 WHERE NOT EXISTS (SELECT 1 FROM public.escala_plantao x WHERE x.perfil_id = e.perfil::uuid AND x.setor_id = e.setor::uuid
                     AND x.data = d::date AND x.turno = t AND x.ativo);

COMMIT;

SELECT 'rede da Fase 5 pronta' AS situacao,
       (SELECT count(*) FROM public.unidades WHERE organizacao_id = 'f5000000-0000-4000-8000-000000000001') AS unidades,
       (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id JOIN public.unidades u ON u.id = s.unidade_id
         WHERE u.organizacao_id = 'f5000000-0000-4000-8000-000000000001') AS leitos,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'f5200000%') AS contas;
