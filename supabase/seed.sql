-- ════════════════════════════════════════════════════════════════════════════
-- Seed SÓ PARA O BANCO LOCAL (npx supabase start / db reset).
-- `supabase db push` não executa seeds: nada disto chega à produção.
--
-- Dados inteiramente fictícios, para ver as telas no navegador durante o
-- porte do frontend. Usuários de teste (senha de todos: coruja-teste-local):
--   gestor@teste.local        gestor da Unidade Teste
--   plantonista@teste.local   plantonista escalado AGORA na Clínica Médica
--   admin@teste.local         admin da organização
-- ════════════════════════════════════════════════════════════════════════════

-- ── Usuários (auth) ─────────────────────────────────────────────────────────
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('coruja-teste-local', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', u.nome)::jsonb,
       now(), now(), '', '', '', ''
FROM (VALUES
  ('10000000-0000-4000-8000-000000000001'::uuid, 'gestor@teste.local',      'Gestora de Teste'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'plantonista@teste.local', 'Plantonista de Teste'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'admin@teste.local',       'Admin de Teste')
) AS u(id, email, nome)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text,
       json_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
FROM auth.users u
WHERE u.email LIKE '%@teste.local'
  AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

INSERT INTO public.perfis (id, nome_completo)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Gestora de Teste'),
  ('10000000-0000-4000-8000-000000000002', 'Plantonista de Teste'),
  ('10000000-0000-4000-8000-000000000003', 'Admin de Teste')
ON CONFLICT (id) DO NOTHING;

-- ── Organização, unidade, setores e leitos ─────────────────────────────────
INSERT INTO public.organizacoes (id, nome) VALUES
  ('20000000-0000-4000-8000-000000000001', 'Rede de Teste')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.unidades (id, organizacao_id, nome, tipo, latitude, longitude, raio_metros) VALUES
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Unidade Teste', 'hospital', -16.6869, -49.2648, 500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem) VALUES
  ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Clínica Médica', 'internacao', 1),
  ('22000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'Observação', 'observacao', 2),
  ('22000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'Pronto Socorro', 'emergencia', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leitos (setor_id, identificador, status)
SELECT '22000000-0000-4000-8000-000000000001', n || l, CASE WHEN n || l IN ('12A', '12B', '14A') THEN 'ocupado' ELSE 'livre' END::public.status_leito
FROM unnest(ARRAY['12', '13', '14']) n, unnest(ARRAY['A', 'B']) l
WHERE NOT EXISTS (SELECT 1 FROM public.leitos WHERE setor_id = '22000000-0000-4000-8000-000000000001');

INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('10000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'gestor'),
  ('10000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'plantonista'),
  ('10000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'admin')
ON CONFLICT DO NOTHING;

-- ── Escala: o plantonista está de plantão agora, na Clínica Médica ─────────
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000002', d, t
FROM generate_series(private.data_atual() - 1, private.data_atual() + 1, interval '1 day') d,
     unnest(ARRAY['manha', 'tarde', 'noite']) t
ON CONFLICT DO NOTHING;

-- ── Pacientes fictícios ─────────────────────────────────────────────────────
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, prontuario, setor_id) VALUES
  ('23000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Paciente Fictício Um',   '1951-03-12', 'M', '2026.000001', '22000000-0000-4000-8000-000000000001'),
  ('23000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'Paciente Fictícia Dois', '1968-07-30', 'F', '2026.000002', '22000000-0000-4000-8000-000000000001'),
  ('23000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'Paciente Fictício Três', '1983-11-02', 'M', '2026.000003', '22000000-0000-4000-8000-000000000001'),
  ('23000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000001', 'Criança Fictícia Quatro','2019-05-20', 'F', '2026.000004', '22000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, status, setor_atual_id, data_admissao)
SELECT '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', p.id,
       CASE WHEN p.setor_id = '22000000-0000-4000-8000-000000000002' THEN 'em_observacao' ELSE 'internado' END,
       p.setor_id, now() - (row_number() OVER (ORDER BY p.id)) * interval '7 hours'
FROM public.pacientes p
WHERE p.unidade_id = '21000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p.id);

-- Sinais vitais crus (sem marca de alterado na origem; a flag é do banco atual)
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, valor_num, aferido_em, registrado_por)
SELECT '21000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', c.id, v.valor, now() - v.h * interval '1 hour', '10000000-0000-4000-8000-000000000002'
FROM (VALUES
  ('frequencia-cardiaca', 96, 6), ('frequencia-cardiaca', 108, 1),
  ('frequencia-respiratoria', 20, 6), ('frequencia-respiratoria', 24, 1),
  ('pressao-arterial-sistolica', 118, 6), ('pressao-arterial-sistolica', 102, 1),
  ('saturacao-o2', 95, 6), ('saturacao-o2', 92, 1),
  ('temperatura', 37.4, 6), ('temperatura', 38.1, 1)
) AS v(nome, valor, h)
JOIN public.conceito c ON c.nome = v.nome AND c.unidade_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM public.observacao o WHERE o.paciente_id = '23000000-0000-4000-8000-000000000001');
