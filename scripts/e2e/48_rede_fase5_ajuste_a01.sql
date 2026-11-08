-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/): ajuste do AMBIENTE F5 depois
-- da execução do A01 (docs/teste-rede/EXECUCAO-A01.md). Autorizado pelo RT em
-- 06/11/2026. Só ambiente: nenhuma função ou tabela do produto muda.
--
-- Por quê:
--   • P1-2 — ninguém da escala F5 alcançava a paciente na Observação Adulto
--     (só o técnico estava escalado): finalizar_observacao, painel_observacao,
--     SAE, balanço e sinais do box davam "Acesso negado". Entram um médico e
--     uma enfermeira escalados na Observação Adulto da UPA.
--   • P1-1 — o Hospital F5 não tinha porta, e registrar_ficha (a única RPC que
--     cria paciente) só abre ficha num setor de emergência: a chegada regulada
--     não tinha como virar internação. Entra o setor "Porta do Hospital"
--     (emergencia) com 2 leitos de estabilização; a recepção e a enfermeira do
--     hospital passam a ser escaladas nele (de hoje em diante).
--   • Médico na porta do hospital (além do pedido inicial): a escala recusa a
--     mesma pessoa em dois setores no mesmo horário (trg_escala_sem_sobreposicao),
--     e o medico.hospital.f5 precisa seguir na Clínica Médica para admitir,
--     laudar a AIH e cuidar da internação. Sem um médico na porta, ninguém
--     assume a ficha aberta lá (iniciar_atendimento exige o setor na escala).
--
-- O que entra:
--   • contas medico.observacao.f5 (…025, plantonista, CRM 950025, CBO 225125),
--     enfermeiro.observacao.f5 (…026, enfermeiro, CBO 223505) e
--     medico.porta.hospital.f5 (…027, plantonista, CRM 950027, CBO 225125),
--     com o MESMO hash de senha de medico.upa.f5 (copiado no banco, como no 46);
--   • CNS fictício com dígito verificador válido (começa com 7);
--   • escala de ontem a daqui a 7 dias, três turnos: as duas primeiras na
--     Observação Adulto (…012), a terceira na Porta do Hospital (…024);
--   • escala da recepcao.hospital.f5 (…022) e da enfermeiro.hospital.f5 (…024)
--     movida do setor 21 para a porta, de hoje (Brasília) em diante.
-- O hospital já tem protocolo de classificação (o 40 define para UPA e hospital).
--
-- Uso: SÓ homologação. Repetível (ON CONFLICT / NOT EXISTS). Depois, rodar o 41.
--   npx supabase db query --linked -f scripts/e2e/48_rede_fase5_ajuste_a01.sql
-- Reverter: apagar as escalas e os vínculos dos perfis …025 a …027, devolver a
-- escala de …022 e …024 ao setor …021 e desativar o setor …024.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.setores WHERE id = 'f5300000-0000-4000-8000-000000000023') THEN
    RAISE EXCEPTION 'Rede F5 ampliada ausente: rode antes scripts/e2e/46_rede_fase5_ampliacao.sql.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'medico.upa.f5@teste.local' AND encrypted_password <> '') THEN
    RAISE EXCEPTION 'Conta medico.upa.f5 sem senha: não há hash para copiar.';
  END IF;
  IF (SELECT protocolo_classificacao_id FROM public.unidades WHERE id = 'f5100000-0000-4000-8000-000000000003') IS NULL THEN
    RAISE EXCEPTION 'Hospital F5 sem protocolo de classificação: rode o 40.';
  END IF;
END $$;

-- ── P1-1: porta do hospital ─────────────────────────────────────────────────
INSERT INTO public.setores (id, unidade_id, nome, tipo, ordem, publico, regulacao_tipo_leito) VALUES
  ('f5300000-0000-4000-8000-000000000024', 'f5100000-0000-4000-8000-000000000003', 'Porta do Hospital', 'emergencia', 0, 'todos', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leitos (setor_id, identificador, tipo, status)
SELECT 'f5300000-0000-4000-8000-000000000024', 'EST-' || lpad(n::text, 2, '0'), 'estabilizacao', 'livre'
  FROM generate_series(1, 2) n
 WHERE NOT EXISTS (SELECT 1 FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000024');

-- ── contas novas (mesmo hash de senha das contas F5) ────────────────────────
CREATE TEMP TABLE f5_ajuste (id uuid, email text, nome text, crm text, cns text, cbo text, unidade uuid, setor uuid, papel text) ON COMMIT DROP;
INSERT INTO f5_ajuste VALUES
  ('f5200000-0000-4000-8000-000000000025', 'medico.observacao.f5@teste.local',     'Médico da Observação F5',       '950025', '709950000000272', '225125',
   'f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000012', 'plantonista'),
  ('f5200000-0000-4000-8000-000000000026', 'enfermeiro.observacao.f5@teste.local', 'Enfermeira da Observação F5',   NULL,     '709950000000280', '223505',
   'f5100000-0000-4000-8000-000000000002', 'f5300000-0000-4000-8000-000000000012', 'enfermeiro'),
  ('f5200000-0000-4000-8000-000000000027', 'medico.porta.hospital.f5@teste.local', 'Médico da Porta do Hospital F5', '950027', '709950000000299', '225125',
   'f5100000-0000-4000-8000-000000000003', 'f5300000-0000-4000-8000-000000000024', 'plantonista');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email,
       (SELECT u.encrypted_password FROM auth.users u WHERE u.email = 'medico.upa.f5@teste.local'), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM f5_ajuste c
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.id::text, json_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
  FROM f5_ajuste c WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = c.id);
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email FROM f5_ajuste c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;
UPDATE public.perfis p SET cns = c.cns, cbo = c.cbo
  FROM f5_ajuste c WHERE p.id = c.id AND EXISTS (SELECT 1 FROM terminologia.cbo t WHERE t.codigo = c.cbo);

INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT c.id, c.unidade, c.papel::public.papel FROM f5_ajuste c
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = c.id AND x.unidade_id = c.unidade AND x.papel = c.papel::public.papel);

-- ── escala das contas novas: ontem a daqui a 7 dias, três turnos ────────────
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT c.unidade, c.setor, c.id, d::date, t
  FROM f5_ajuste c,
       generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 7, interval '1 day') d,
       unnest(ARRAY['manha', 'tarde', 'noite']) t
 WHERE NOT EXISTS (SELECT 1 FROM public.escala_plantao x WHERE x.perfil_id = c.id AND x.data = d::date AND x.turno = t AND x.ativo);

-- ── recepção e enfermeira do hospital passam para a porta (de hoje em diante)
UPDATE public.escala_plantao
   SET setor_id = 'f5300000-0000-4000-8000-000000000024'
 WHERE perfil_id IN ('f5200000-0000-4000-8000-000000000022', 'f5200000-0000-4000-8000-000000000024')
   AND setor_id = 'f5300000-0000-4000-8000-000000000021'
   AND data >= (now() AT TIME ZONE 'America/Sao_Paulo')::date;

COMMIT;

SELECT 'rede F5 ajustada para o A01' AS situacao,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'f5200000%') AS contas,
       (SELECT count(*) FROM public.leitos WHERE setor_id = 'f5300000-0000-4000-8000-000000000024') AS leitos_porta_hospital,
       (SELECT count(*) FROM public.escala_plantao WHERE setor_id = 'f5300000-0000-4000-8000-000000000012' AND ativo
          AND perfil_id IN ('f5200000-0000-4000-8000-000000000025', 'f5200000-0000-4000-8000-000000000026')) AS escalas_observacao,
       (SELECT count(*) FROM public.escala_plantao WHERE setor_id = 'f5300000-0000-4000-8000-000000000024' AND ativo) AS escalas_porta_hospital;
