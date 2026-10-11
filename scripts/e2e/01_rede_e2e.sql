-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta (portão antes da Fase 5) — rede de teste isolada.
--
-- Cria uma organização própria ("Rede E2E"), com CNES fictícios, a UPA de
-- origem, três serviços de destino (hospital terciário, maternidade, UTI de
-- referência), a Central de Regulação, setores, leitos, uma conta por papel,
-- escala de hoje a depois de amanhã e o check-in dos plantões de agora.
--
-- Uso (ambiente local ou homologação; NUNCA produção):
--   psql ... -v senha='<senha de teste>' -f scripts/e2e/01_rede_e2e.sql
-- A senha é a de teste do ambiente; não fica gravada aqui.
-- Repetível: apaga nada, usa ON CONFLICT. Para recomeçar do zero, use
-- scripts/e2e/99_limpar_rede_e2e.sql.
-- Unidades sem coordenadas: o check-in não usa cerca geográfica.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
BEGIN;

-- ── organização e unidades ──────────────────────────────────────────────────
INSERT INTO public.organizacoes (id, nome) VALUES ('e1000000-0000-4000-8000-000000000001', 'Rede E2E')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf) VALUES
  ('e1100000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'UPA E2E 24h',               'upa',      '9990010', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'Hospital Terciário E2E',    'hospital', '9990029', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 'Maternidade E2E',           'hospital', '9990037', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000001', 'UTI de Referência E2E',     'hospital', '9990045', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000009', 'e1000000-0000-4000-8000-000000000001', 'Central de Regulação E2E',  'upa',      NULL,      'Cidade Teste', 'SP')
ON CONFLICT (id) DO NOTHING;

-- a UPA usa o protocolo de classificação já carregado no ambiente
UPDATE public.unidades SET protocolo_classificacao_id = (SELECT id FROM public.protocolos_classificacao ORDER BY codigo LIMIT 1)
 WHERE id = 'e1100000-0000-4000-8000-000000000001' AND protocolo_classificacao_id IS NULL;

-- ── contas de teste (uma por papel) ─────────────────────────────────────────
CREATE TEMP TABLE e2e_contas (id uuid, email text, nome text, crm text) ON COMMIT DROP;
INSERT INTO e2e_contas VALUES
  ('e2000000-0000-4000-8000-000000000001', 'recepcao.e2e@teste.local',     'Recepção E2E',              NULL),
  ('e2000000-0000-4000-8000-000000000002', 'enfermeiro.e2e@teste.local',   'Enfermeira E2E',            NULL),
  ('e2000000-0000-4000-8000-000000000003', 'tecnico.e2e@teste.local',      'Técnico de Enfermagem E2E', NULL),
  ('e2000000-0000-4000-8000-000000000004', 'plantonista.e2e@teste.local',  'Plantonista E2E',           '900001'),
  ('e2000000-0000-4000-8000-000000000005', 'plantonista2.e2e@teste.local', 'Plantonista Dois E2E',      '900002'),
  ('e2000000-0000-4000-8000-000000000006', 'farmaceutico.e2e@teste.local', 'Farmacêutica E2E',          NULL),
  ('e2000000-0000-4000-8000-000000000007', 'regulador.e2e@teste.local',    'Regulador E2E',             '900007'),
  ('e2000000-0000-4000-8000-000000000008', 'nir.e2e@teste.local',          'NIR E2E',                   NULL),
  ('e2000000-0000-4000-8000-000000000009', 'gestor.e2e@teste.local',       'Gestora E2E',               NULL),
  ('e2000000-0000-4000-8000-000000000010', 'admin.e2e@teste.local',        'Admin E2E',                 NULL),
  ('e2000000-0000-4000-8000-000000000011', 'faturamento.e2e@teste.local',  'Faturamento E2E',           NULL),
  ('e2000000-0000-4000-8000-000000000012', 'medico.hospital.e2e@teste.local', 'Médico do Hospital E2E', '900012'),
  ('e2000000-0000-4000-8000-000000000013', 'medico.maternidade.e2e@teste.local', 'Médica da Maternidade E2E', '900013'),
  ('e2000000-0000-4000-8000-000000000014', 'medico.uti.e2e@teste.local',   'Médico da UTI E2E',         '900014');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email, crypt(:'senha', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM e2e_contas c
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.id::text, json_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
  FROM e2e_contas c WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = c.id);
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email FROM e2e_contas c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;
-- o admin da rede E2E também administra a plataforma (central, módulos)
INSERT INTO public.super_admins (perfil_id) VALUES ('e2000000-0000-4000-8000-000000000010') ON CONFLICT DO NOTHING;
-- Central de Regulação da rede
INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
SELECT 'e1000000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000009', 'e2000000-0000-4000-8000-000000000010'
WHERE NOT EXISTS (SELECT 1 FROM public.centrais_regulacao WHERE organizacao_id = 'e1000000-0000-4000-8000-000000000001');

-- ── setores e leitos ────────────────────────────────────────────────────────
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico, regulacao_tipo_leito) VALUES
  -- UPA de origem
  ('e1200000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'Pronto Socorro',        'emergencia', 1, 'todos',      NULL),
  ('e1200000-0000-4000-8000-000000000002', 'e1100000-0000-4000-8000-000000000001', 'Sala Vermelha',         'emergencia', 2, 'todos',      NULL),
  ('e1200000-0000-4000-8000-000000000003', 'e1100000-0000-4000-8000-000000000001', 'Observação Adulto',     'observacao', 3, 'adulto',     NULL),
  ('e1200000-0000-4000-8000-000000000004', 'e1100000-0000-4000-8000-000000000001', 'Observação Pediátrica', 'observacao', 4, 'pediatrico', NULL),
  ('e1200000-0000-4000-8000-000000000005', 'e1100000-0000-4000-8000-000000000001', 'Internação',            'internacao', 5, 'todos',      NULL),
  ('e1200000-0000-4000-8000-000000000006', 'e1100000-0000-4000-8000-000000000001', 'Isolamento',            'isolamento', 6, 'todos',      NULL),
  -- destinos
  ('e1200000-0000-4000-8000-000000000011', 'e1100000-0000-4000-8000-000000000002', 'Clínica Médica',        'internacao', 1, 'adulto',     'clinico'),
  ('e1200000-0000-4000-8000-000000000012', 'e1100000-0000-4000-8000-000000000002', 'Clínica Cirúrgica',     'internacao', 2, 'adulto',     'cirurgico'),
  ('e1200000-0000-4000-8000-000000000013', 'e1100000-0000-4000-8000-000000000002', 'Psiquiatria',           'internacao', 3, 'adulto',     'psiquiatrico'),
  ('e1200000-0000-4000-8000-000000000014', 'e1100000-0000-4000-8000-000000000002', 'Pediatria',             'internacao', 4, 'pediatrico', 'pediatrico'),
  ('e1200000-0000-4000-8000-000000000015', 'e1100000-0000-4000-8000-000000000002', 'Unidade Coronariana',   'uti',        5, 'adulto',     'unidade_coronariana'),
  ('e1200000-0000-4000-8000-000000000021', 'e1100000-0000-4000-8000-000000000003', 'Obstetrícia',           'internacao', 1, 'adulto',     'obstetrico'),
  ('e1200000-0000-4000-8000-000000000031', 'e1100000-0000-4000-8000-000000000004', 'UTI Adulto',            'uti',        1, 'adulto',     'uti_adulto'),
  ('e1200000-0000-4000-8000-000000000032', 'e1100000-0000-4000-8000-000000000004', 'UTI Pediátrica',        'uti',        2, 'pediatrico', 'uti_pediatrica'),
  ('e1200000-0000-4000-8000-000000000091', 'e1100000-0000-4000-8000-000000000009', 'Regulação',             'outro',      1, 'todos',      NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT s.id, x.prefixo || '-' || lpad(n::text, 2, '0'), x.tipo::public.tipo_leito, 'livre'
  FROM (VALUES ('e1200000-0000-4000-8000-000000000001'::uuid, 'PS', 'clinico', 6), ('e1200000-0000-4000-8000-000000000002'::uuid, 'SV', 'estabilizacao', 2),
               ('e1200000-0000-4000-8000-000000000003'::uuid, 'OA', 'observacao', 8), ('e1200000-0000-4000-8000-000000000004'::uuid, 'OP', 'observacao', 4),
               ('e1200000-0000-4000-8000-000000000005'::uuid, 'INT', 'clinico', 6), ('e1200000-0000-4000-8000-000000000006'::uuid, 'ISO', 'isolamento', 2),
               ('e1200000-0000-4000-8000-000000000011'::uuid, 'CM', 'clinico', 4), ('e1200000-0000-4000-8000-000000000012'::uuid, 'CC', 'clinico', 4),
               ('e1200000-0000-4000-8000-000000000013'::uuid, 'PSQ', 'clinico', 2), ('e1200000-0000-4000-8000-000000000014'::uuid, 'PED', 'clinico', 2),
               ('e1200000-0000-4000-8000-000000000015'::uuid, 'UCO', 'clinico', 2), ('e1200000-0000-4000-8000-000000000021'::uuid, 'OBS', 'clinico', 3),
               ('e1200000-0000-4000-8000-000000000031'::uuid, 'UTI', 'clinico', 4), ('e1200000-0000-4000-8000-000000000032'::uuid, 'UTIP', 'clinico', 2)) x(setor, prefixo, tipo, qtd)
  JOIN public.setores s ON s.id = x.setor, generate_series(1, x.qtd) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.id);

-- ── vínculos ────────────────────────────────────────────────────────────────
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT v.perfil::uuid, v.unidade::uuid, v.papel::public.papel
  FROM (VALUES
    ('e2000000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000001', 'recepcao'),
    ('e2000000-0000-4000-8000-000000000002', 'e1100000-0000-4000-8000-000000000001', 'enfermeiro'),
    ('e2000000-0000-4000-8000-000000000003', 'e1100000-0000-4000-8000-000000000001', 'tecnico_enfermagem'),
    ('e2000000-0000-4000-8000-000000000004', 'e1100000-0000-4000-8000-000000000001', 'plantonista'),
    ('e2000000-0000-4000-8000-000000000005', 'e1100000-0000-4000-8000-000000000001', 'plantonista'),
    ('e2000000-0000-4000-8000-000000000006', 'e1100000-0000-4000-8000-000000000001', 'farmaceutico'),
    ('e2000000-0000-4000-8000-000000000007', 'e1100000-0000-4000-8000-000000000009', 'regulador'),
    ('e2000000-0000-4000-8000-000000000007', 'e1100000-0000-4000-8000-000000000001', 'regulador'),
    ('e2000000-0000-4000-8000-000000000008', 'e1100000-0000-4000-8000-000000000001', 'nir'),
    ('e2000000-0000-4000-8000-000000000009', 'e1100000-0000-4000-8000-000000000001', 'gestor'),
    ('e2000000-0000-4000-8000-000000000009', 'e1100000-0000-4000-8000-000000000009', 'gestor'),
    ('e2000000-0000-4000-8000-000000000010', 'e1100000-0000-4000-8000-000000000001', 'admin'),
    ('e2000000-0000-4000-8000-000000000011', 'e1100000-0000-4000-8000-000000000001', 'faturamento'),
    ('e2000000-0000-4000-8000-000000000012', 'e1100000-0000-4000-8000-000000000002', 'plantonista'),
    ('e2000000-0000-4000-8000-000000000013', 'e1100000-0000-4000-8000-000000000003', 'plantonista'),
    ('e2000000-0000-4000-8000-000000000014', 'e1100000-0000-4000-8000-000000000004', 'plantonista')) v(perfil, unidade, papel)
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = v.perfil::uuid AND x.unidade_id = v.unidade::uuid AND x.papel = v.papel::public.papel);

-- ── escala: hoje, amanhã e depois, nos três turnos, para quem entra pela escala ─
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT e.unidade::uuid, e.setor::uuid, e.perfil::uuid, d::date, t
  FROM (VALUES
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000003'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000004'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000005'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000006'),
    ('e1100000-0000-4000-8000-000000000009', 'e1200000-0000-4000-8000-000000000091', 'e2000000-0000-4000-8000-000000000007'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000008'),
    -- equipe da observação, internação e isolamento da UPA (sem ela, o internado fica sem ninguém no setor)
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000005'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000005', 'e2000000-0000-4000-8000-000000000005'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000005'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000005', 'e2000000-0000-4000-8000-000000000004'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000002'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000005', 'e2000000-0000-4000-8000-000000000002'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000002'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000003'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000005', 'e2000000-0000-4000-8000-000000000003'),
    ('e1100000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000003'),
    ('e1100000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000011', 'e2000000-0000-4000-8000-000000000012'),
    ('e1100000-0000-4000-8000-000000000003', 'e1200000-0000-4000-8000-000000000021', 'e2000000-0000-4000-8000-000000000013'),
    ('e1100000-0000-4000-8000-000000000004', 'e1200000-0000-4000-8000-000000000031', 'e2000000-0000-4000-8000-000000000014')) e(unidade, setor, perfil),
       generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 2, interval '1 day') d,
       unnest(ARRAY['manha', 'tarde', 'noite']) t
 WHERE NOT EXISTS (SELECT 1 FROM public.escala_plantao x WHERE x.perfil_id = e.perfil::uuid AND x.setor_id = e.setor::uuid
                     AND x.data = d::date AND x.turno = t AND x.ativo);

COMMIT;

SELECT 'rede E2E pronta' AS situacao,
       (SELECT count(*) FROM public.unidades WHERE organizacao_id = 'e1000000-0000-4000-8000-000000000001') AS unidades,
       (SELECT count(*) FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id JOIN public.unidades u ON u.id = s.unidade_id
         WHERE u.organizacao_id = 'e1000000-0000-4000-8000-000000000001') AS leitos,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'e2000000%') AS contas;
