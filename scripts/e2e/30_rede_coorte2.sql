-- ════════════════════════════════════════════════════════════════════════════
-- Rodada 2 do teste de ponta a ponta (Portão 2) — unidades de destino da
-- coorte 2, com CNES fictícios: hospital infantil, maternidade de alto risco,
-- hospital psiquiátrico (CAPS), centro de queimados, hospital de trauma e
-- CIATox de referência. Um médico de destino por unidade (contas 015 a 020).
-- Roda depois de 01_rede_e2e.sql (mesma rede, mesma senha de teste).
-- Ambiente local ou homologação; NUNCA produção. Repetível (ON CONFLICT).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.unidades (id, organizacao_id, nome, tipo, cnes, municipio, uf) VALUES
  ('e1100000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', 'Hospital Infantil E2E',            'hospital', '9990053', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000001', 'Maternidade de Alto Risco E2E',    'hospital', '9990061', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000001', 'Hospital Psiquiátrico E2E (CAPS)', 'hospital', '9990070', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000008', 'e1000000-0000-4000-8000-000000000001', 'Centro de Queimados E2E',          'hospital', '9990088', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000010', 'e1000000-0000-4000-8000-000000000001', 'Hospital de Trauma E2E',           'hospital', '9990096', 'Cidade Teste', 'SP'),
  ('e1100000-0000-4000-8000-000000000011', 'e1000000-0000-4000-8000-000000000001', 'CIATox de Referência E2E',         'hospital', '9990100', 'Cidade Teste', 'SP')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE e2e_contas2 (id uuid, email text, nome text, crm text) ON COMMIT DROP;
INSERT INTO e2e_contas2 VALUES
  ('e2000000-0000-4000-8000-000000000015', 'medico.infantil.e2e@teste.local',    'Pediatra do Hospital Infantil E2E',   '900015'),
  ('e2000000-0000-4000-8000-000000000016', 'medico.altorisco.e2e@teste.local',   'Obstetra da Maternidade de Alto Risco E2E', '900016'),
  ('e2000000-0000-4000-8000-000000000017', 'medico.psiquiatria.e2e@teste.local', 'Psiquiatra E2E',                      '900017'),
  ('e2000000-0000-4000-8000-000000000018', 'medico.queimados.e2e@teste.local',   'Cirurgião do Centro de Queimados E2E', '900018'),
  ('e2000000-0000-4000-8000-000000000019', 'medico.trauma.e2e@teste.local',      'Cirurgião do Trauma E2E',             '900019'),
  ('e2000000-0000-4000-8000-000000000020', 'toxicologista.e2e@teste.local',      'Toxicologista do CIATox E2E',         '900020');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email, crypt(:'senha', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM e2e_contas2 c
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.id::text, json_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
  FROM e2e_contas2 c WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = c.id);
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, 'SP', c.email FROM e2e_contas2 c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;

INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico, regulacao_tipo_leito) VALUES
  ('e1200000-0000-4000-8000-000000000051', 'e1100000-0000-4000-8000-000000000005', 'Pediatria',                 'internacao', 1, 'pediatrico', 'pediatrico'),
  ('e1200000-0000-4000-8000-000000000052', 'e1100000-0000-4000-8000-000000000005', 'UTI Neonatal',              'uti',        2, 'pediatrico', 'uti_neonatal'),
  ('e1200000-0000-4000-8000-000000000053', 'e1100000-0000-4000-8000-000000000005', 'UTI Pediátrica',            'uti',        3, 'pediatrico', 'uti_pediatrica'),
  ('e1200000-0000-4000-8000-000000000061', 'e1100000-0000-4000-8000-000000000006', 'Obstetrícia de Alto Risco', 'internacao', 1, 'adulto',     'obstetrico'),
  ('e1200000-0000-4000-8000-000000000071', 'e1100000-0000-4000-8000-000000000007', 'Psiquiatria',               'internacao', 1, 'adulto',     'psiquiatrico'),
  ('e1200000-0000-4000-8000-000000000081', 'e1100000-0000-4000-8000-000000000008', 'Queimados',                 'uti',        1, 'adulto',     'uti_queimados'),
  ('e1200000-0000-4000-8000-000000000101', 'e1100000-0000-4000-8000-000000000010', 'Trauma',                    'internacao', 1, 'adulto',     'cirurgico'),
  ('e1200000-0000-4000-8000-000000000111', 'e1100000-0000-4000-8000-000000000011', 'Toxicologia',               'internacao', 1, 'todos',      'clinico')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT s.id, x.prefixo || '-' || lpad(n::text, 2, '0'), 'clinico'::public.tipo_leito, 'livre'
  FROM (VALUES ('e1200000-0000-4000-8000-000000000051'::uuid, 'HIP', 3), ('e1200000-0000-4000-8000-000000000052'::uuid, 'NEO', 2),
               ('e1200000-0000-4000-8000-000000000053'::uuid, 'HUP', 2), ('e1200000-0000-4000-8000-000000000061'::uuid, 'OAR', 3),
               ('e1200000-0000-4000-8000-000000000071'::uuid, 'PSQ2', 2), ('e1200000-0000-4000-8000-000000000081'::uuid, 'QUE', 2),
               ('e1200000-0000-4000-8000-000000000101'::uuid, 'TRA', 3), ('e1200000-0000-4000-8000-000000000111'::uuid, 'TOX', 2)) x(setor, prefixo, qtd)
  JOIN public.setores s ON s.id = x.setor, generate_series(1, x.qtd) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = s.id);

INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT v.perfil::uuid, v.unidade::uuid, 'plantonista'::public.papel
  FROM (VALUES
    ('e2000000-0000-4000-8000-000000000015', 'e1100000-0000-4000-8000-000000000005'),
    ('e2000000-0000-4000-8000-000000000016', 'e1100000-0000-4000-8000-000000000006'),
    ('e2000000-0000-4000-8000-000000000017', 'e1100000-0000-4000-8000-000000000007'),
    ('e2000000-0000-4000-8000-000000000018', 'e1100000-0000-4000-8000-000000000008'),
    ('e2000000-0000-4000-8000-000000000019', 'e1100000-0000-4000-8000-000000000010'),
    ('e2000000-0000-4000-8000-000000000020', 'e1100000-0000-4000-8000-000000000011')) v(perfil, unidade)
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = v.perfil::uuid AND x.unidade_id = v.unidade::uuid AND x.papel = 'plantonista');

-- escala dos médicos de destino: de ontem a depois de amanhã, três turnos
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT s.unidade_id, s.id, e.perfil::uuid, d::date, t
  FROM (VALUES
    ('e2000000-0000-4000-8000-000000000015', 'e1200000-0000-4000-8000-000000000051'),
    ('e2000000-0000-4000-8000-000000000015', 'e1200000-0000-4000-8000-000000000052'),
    ('e2000000-0000-4000-8000-000000000015', 'e1200000-0000-4000-8000-000000000053'),
    ('e2000000-0000-4000-8000-000000000016', 'e1200000-0000-4000-8000-000000000061'),
    ('e2000000-0000-4000-8000-000000000017', 'e1200000-0000-4000-8000-000000000071'),
    ('e2000000-0000-4000-8000-000000000018', 'e1200000-0000-4000-8000-000000000081'),
    ('e2000000-0000-4000-8000-000000000019', 'e1200000-0000-4000-8000-000000000101'),
    ('e2000000-0000-4000-8000-000000000020', 'e1200000-0000-4000-8000-000000000111')) e(perfil, setor)
  JOIN public.setores s ON s.id = e.setor::uuid,
       generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 2, interval '1 day') d,
       unnest(ARRAY['manha', 'tarde', 'noite']) t
 WHERE NOT EXISTS (SELECT 1 FROM public.escala_plantao x WHERE x.perfil_id = e.perfil::uuid AND x.setor_id = s.id
                     AND x.data = d::date AND x.turno = t AND x.ativo);

COMMIT;

SELECT 'unidades da coorte 2 prontas' AS situacao,
       (SELECT count(*) FROM public.unidades WHERE organizacao_id = 'e1000000-0000-4000-8000-000000000001') AS unidades,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'e2000000%') AS contas;
