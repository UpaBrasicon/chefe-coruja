-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (BACKLOG, frente de 06/11/2026, tarefa 2):
-- prepara a rede F5 para os 30 cenários de docs/teste-rede/.
--
-- O que acrescenta, sem apagar nada:
--   • Secretaria F5 e o módulo de rede ligado, com UBS, UPA e hospital liberados;
--   • setores: observação pediátrica e isolamento na UPA; UTI adulto e
--     obstétrico no hospital (para a regulação dos cenários A01, A06, B01);
--   • contas que faltavam: técnico da UPA, telemedicina, admin da organização,
--     secretaria, regulação regional, faturamento da rede, recepção, gestor e
--     enfermeiro do hospital;
--   • vínculos a mais: regulador também na UPA e no hospital (decidir AIH e
--     APAC), faturamento e NIR também no hospital;
--   • CNS fictícios (15 dígitos, dígito verificador válido, começam com 7) e
--     CBO da tabela terminologia.cbo em todos os perfis F5;
--   • escala de ontem a daqui a 7 dias, nos três turnos, para todas as contas
--     que dependem de escala.
--
-- Senha: as contas novas recebem o MESMO hash de senha das contas F5 que já
-- existem (copiado no banco). Nenhuma senha aparece aqui.
-- Coordenadas: NÃO são definidas, de propósito. Com coordenadas, o check-in na
-- tela exige estar a 500 m da unidade e barraria quem testa de longe. O cenário
-- D03 põe a coordenada numa unidade só durante o teste e a retira depois.
--
-- Uso: SÓ homologação. Repetível (ON CONFLICT / NOT EXISTS).
--   npx supabase db query --linked -f scripts/e2e/46_rede_fase5_ampliacao.sql
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = 'f5100000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Rede F5 ausente: rode antes scripts/e2e/40_rede_fase5.sql.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'medico.upa.f5@teste.local' AND encrypted_password <> '') THEN
    RAISE EXCEPTION 'Conta medico.upa.f5 sem senha: não há hash para copiar.';
  END IF;
END $$;

-- ── Secretaria (unidade administrativa da rede) ─────────────────────────────
INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf) VALUES
  ('f5100000-0000-4000-8000-000000000008', 'f5000000-0000-4000-8000-000000000001', 'Secretaria de Saúde F5', 'clinica', NULL, 'Cidade Teste', 'SP')
ON CONFLICT (id) DO NOTHING;

-- ── setores novos ───────────────────────────────────────────────────────────
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico, regulacao_tipo_leito) VALUES
  ('f5300000-0000-4000-8000-000000000014', 'f5100000-0000-4000-8000-000000000002', 'Observação Pediátrica', 'observacao', 4, 'pediatrico', NULL),
  ('f5300000-0000-4000-8000-000000000015', 'f5100000-0000-4000-8000-000000000002', 'Isolamento',            'isolamento', 5, 'todos',      NULL),
  ('f5300000-0000-4000-8000-000000000022', 'f5100000-0000-4000-8000-000000000003', 'UTI Adulto',            'uti',        2, 'adulto',     'uti_adulto'),
  ('f5300000-0000-4000-8000-000000000023', 'f5100000-0000-4000-8000-000000000003', 'Obstetrícia',           'internacao', 3, 'adulto',     'obstetrico'),
  ('f5300000-0000-4000-8000-000000000081', 'f5100000-0000-4000-8000-000000000008', 'Secretaria',            'outro',      1, 'todos',      NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT s.id, x.prefixo || '-' || lpad(n::text, 2, '0'), x.tipo::public.tipo_leito, 'livre'
  FROM (VALUES ('f5300000-0000-4000-8000-000000000014'::uuid, 'OP', 'observacao', 3),
               ('f5300000-0000-4000-8000-000000000015'::uuid, 'ISO', 'isolamento', 2),
               ('f5300000-0000-4000-8000-000000000022'::uuid, 'UTI', 'clinico', 3),
               ('f5300000-0000-4000-8000-000000000023'::uuid, 'OB', 'clinico', 3)) x(setor, prefixo, tipo, qtd)
  JOIN public.setores s ON s.id = x.setor, generate_series(1, x.qtd) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.id);

-- ── contas novas (mesmo hash de senha das contas F5) ────────────────────────
CREATE TEMP TABLE f5_novas (id uuid, email text, nome text, crm text, conselho text) ON COMMIT DROP;
INSERT INTO f5_novas VALUES
  ('f5200000-0000-4000-8000-000000000016', 'tecnico.upa.f5@teste.local',          'Técnico UPA F5',               NULL,     'COREN'),
  ('f5200000-0000-4000-8000-000000000017', 'telemedicina.f5@teste.local',         'Médica da Telemedicina F5',    '950017', 'CRM'),
  ('f5200000-0000-4000-8000-000000000018', 'admin.f5@teste.local',                'Administração F5',             NULL,     NULL),
  ('f5200000-0000-4000-8000-000000000019', 'secretaria.f5@teste.local',           'Secretaria de Saúde F5',       NULL,     NULL),
  ('f5200000-0000-4000-8000-000000000020', 'regulacao.regional.f5@teste.local',   'Regulação Regional F5',        '950020', 'CRM'),
  ('f5200000-0000-4000-8000-000000000021', 'faturamento.rede.f5@teste.local',     'Faturamento da Rede F5',       NULL,     NULL),
  ('f5200000-0000-4000-8000-000000000022', 'recepcao.hospital.f5@teste.local',    'Recepção do Hospital F5',      NULL,     NULL),
  ('f5200000-0000-4000-8000-000000000023', 'gestor.hospital.f5@teste.local',      'Gestor do Hospital F5',        NULL,     NULL),
  ('f5200000-0000-4000-8000-000000000024', 'enfermeiro.hospital.f5@teste.local',  'Enfermeira do Hospital F5',    NULL,     'COREN');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email,
       (SELECT u.encrypted_password FROM auth.users u WHERE u.email = 'medico.upa.f5@teste.local'), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM f5_novas c
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.id::text, json_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
  FROM f5_novas c WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = c.id);
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email FROM f5_novas c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;

-- ── CNS fictício e CBO (terminologia.cbo) em todos os perfis F5 ─────────────
UPDATE public.perfis p SET cns = x.cns, cbo = x.cbo
  FROM (VALUES
    ('f5200000-0000-4000-8000-000000000001', '709950000000019', '422105'),
    ('f5200000-0000-4000-8000-000000000002', '709950000000027', '223505'),
    ('f5200000-0000-4000-8000-000000000003', '709950000000035', '322205'),
    ('f5200000-0000-4000-8000-000000000004', '709950000000043', '225130'),
    ('f5200000-0000-4000-8000-000000000005', '709950000000051', '131210'),
    ('f5200000-0000-4000-8000-000000000006', '709950000000078', '422105'),
    ('f5200000-0000-4000-8000-000000000007', '709950000000086', '223505'),
    ('f5200000-0000-4000-8000-000000000008', '709950000000094', '225125'),
    ('f5200000-0000-4000-8000-000000000009', '709950000000108', '131210'),
    ('f5200000-0000-4000-8000-000000000010', '709950000000116', '411010'),
    ('f5200000-0000-4000-8000-000000000011', '709950000000124', '225125'),
    ('f5200000-0000-4000-8000-000000000012', '709950000000132', '225125'),
    ('f5200000-0000-4000-8000-000000000013', '709950000000140', '411010'),
    ('f5200000-0000-4000-8000-000000000014', '709950000000159', '223405'),
    ('f5200000-0000-4000-8000-000000000015', '709950000000167', '225125'),
    ('f5200000-0000-4000-8000-000000000016', '709950000000175', '322205'),
    ('f5200000-0000-4000-8000-000000000017', '709950000000183', '225125'),
    ('f5200000-0000-4000-8000-000000000018', '709950000000191', '131205'),
    ('f5200000-0000-4000-8000-000000000019', '709950000000205', '131205'),
    ('f5200000-0000-4000-8000-000000000020', '709950000000213', '225125'),
    ('f5200000-0000-4000-8000-000000000021', '709950000000221', '411010'),
    ('f5200000-0000-4000-8000-000000000022', '709950000000248', '422105'),
    ('f5200000-0000-4000-8000-000000000023', '709950000000256', '131210'),
    ('f5200000-0000-4000-8000-000000000024', '709950000000264', '223505')) x(id, cns, cbo)
 WHERE p.id = x.id::uuid AND EXISTS (SELECT 1 FROM terminologia.cbo c WHERE c.codigo = x.cbo);

-- ── módulo de rede ligado (antes dos vínculos de rede, que o exigem) ───────
INSERT INTO public.rede_modulo (organizacao_id, ativo, secretaria_unidade_id, alterado_por, alterado_em)
VALUES ('f5000000-0000-4000-8000-000000000001', true, 'f5100000-0000-4000-8000-000000000008', 'f5200000-0000-4000-8000-000000000018', now())
ON CONFLICT (organizacao_id) DO UPDATE SET ativo = true, secretaria_unidade_id = excluded.secretaria_unidade_id, alterado_em = now();
INSERT INTO public.rede_unidades_liberadas (unidade_id, liberada, alterado_por, alterado_em)
SELECT u::uuid, true, g::uuid, now()
  FROM (VALUES ('f5100000-0000-4000-8000-000000000001', 'f5200000-0000-4000-8000-000000000005'),
               ('f5100000-0000-4000-8000-000000000002', 'f5200000-0000-4000-8000-000000000009'),
               ('f5100000-0000-4000-8000-000000000003', 'f5200000-0000-4000-8000-000000000023')) x(u, g)
ON CONFLICT (unidade_id) DO UPDATE SET liberada = true, alterado_em = now();

-- ── vínculos ────────────────────────────────────────────────────────────────
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT v.perfil::uuid, v.unidade::uuid, v.papel::public.papel
  FROM (VALUES
    ('f5200000-0000-4000-8000-000000000016', 'f5100000-0000-4000-8000-000000000002', 'tecnico_enfermagem'),
    ('f5200000-0000-4000-8000-000000000017', 'f5100000-0000-4000-8000-000000000002', 'telemedicina'),
    ('f5200000-0000-4000-8000-000000000018', 'f5100000-0000-4000-8000-000000000008', 'admin'),
    ('f5200000-0000-4000-8000-000000000019', 'f5100000-0000-4000-8000-000000000008', 'secretaria'),
    ('f5200000-0000-4000-8000-000000000020', 'f5100000-0000-4000-8000-000000000008', 'regulacao_regional'),
    ('f5200000-0000-4000-8000-000000000021', 'f5100000-0000-4000-8000-000000000008', 'faturamento_rede'),
    ('f5200000-0000-4000-8000-000000000022', 'f5100000-0000-4000-8000-000000000003', 'recepcao'),
    ('f5200000-0000-4000-8000-000000000023', 'f5100000-0000-4000-8000-000000000003', 'gestor'),
    ('f5200000-0000-4000-8000-000000000024', 'f5100000-0000-4000-8000-000000000003', 'enfermeiro'),
    -- regulador decide AIH/APAC na unidade da conta (C02, C03)
    ('f5200000-0000-4000-8000-000000000012', 'f5100000-0000-4000-8000-000000000002', 'regulador'),
    ('f5200000-0000-4000-8000-000000000012', 'f5100000-0000-4000-8000-000000000003', 'regulador'),
    -- faturamento e NIR também no hospital (A01, B03)
    ('f5200000-0000-4000-8000-000000000010', 'f5100000-0000-4000-8000-000000000003', 'faturamento'),
    ('f5200000-0000-4000-8000-000000000013', 'f5100000-0000-4000-8000-000000000003', 'nir')) v(perfil, unidade, papel)
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = v.perfil::uuid AND x.unidade_id = v.unidade::uuid AND x.papel = v.papel::public.papel);

-- ── escala: ontem a daqui a 7 dias, três turnos ─────────────────────────────
-- (gestor, admin e faturamento não dependem de escala)
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
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000013', 'f5200000-0000-4000-8000-000000000015'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000013'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000014'),
    ('f5100000-0000-4000-8000-000000000003', 'f5300000-0000-4000-8000-000000000021', 'f5200000-0000-4000-8000-000000000011'),
    ('f5100000-0000-4000-8000-000000000009', 'f5300000-0000-4000-8000-000000000091', 'f5200000-0000-4000-8000-000000000012'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000012', 'f5200000-0000-4000-8000-000000000016'),
    ('f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000011', 'f5200000-0000-4000-8000-000000000017'),
    ('f5100000-0000-4000-8000-000000000008', 'f5300000-0000-4000-8000-000000000081', 'f5200000-0000-4000-8000-000000000019'),
    ('f5100000-0000-4000-8000-000000000008', 'f5300000-0000-4000-8000-000000000081', 'f5200000-0000-4000-8000-000000000020'),
    ('f5100000-0000-4000-8000-000000000008', 'f5300000-0000-4000-8000-000000000081', 'f5200000-0000-4000-8000-000000000021'),
    ('f5100000-0000-4000-8000-000000000003', 'f5300000-0000-4000-8000-000000000021', 'f5200000-0000-4000-8000-000000000022'),
    ('f5100000-0000-4000-8000-000000000003', 'f5300000-0000-4000-8000-000000000021', 'f5200000-0000-4000-8000-000000000024')) e(unidade, setor, perfil),
       generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 7, interval '1 day') d,
       unnest(ARRAY['manha', 'tarde', 'noite']) t
 WHERE NOT EXISTS (SELECT 1 FROM public.escala_plantao x WHERE x.perfil_id = e.perfil::uuid
                     AND x.data = d::date AND x.turno = t AND x.ativo);

COMMIT;

SELECT 'rede F5 ampliada' AS situacao,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'f5200000%') AS contas,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'f5200000%' AND cns IS NOT NULL AND cbo IS NOT NULL) AS com_cns_cbo,
       (SELECT count(*) FROM public.setores s JOIN public.unidades u ON u.id = s.unidade_id WHERE u.organizacao_id = 'f5000000-0000-4000-8000-000000000001') AS setores,
       (SELECT ativo FROM public.rede_modulo WHERE organizacao_id = 'f5000000-0000-4000-8000-000000000001') AS rede_ativa,
       (SELECT max(data) FROM public.escala_plantao WHERE perfil_id::text LIKE 'f5200000%') AS escala_ate;
