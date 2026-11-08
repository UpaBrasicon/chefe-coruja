-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/): ajuste do AMBIENTE F5 para os
-- cenários A02 a A06 (docs/teste-rede/EXECUCAO-A02-A06.md). Só ambiente:
-- nenhuma função, tabela ou migration do produto muda. Não altera o 46, o 47
-- nem o 48. Só aditivo e repetível.
--
-- Por quê (a mesma lição do P1-2 do A01):
--   • a Observação Pediátrica da UPA (…014, leitos OP-01 a OP-03, criada pelo
--     46) não tem ninguém escalado. Criança que vai para a observação cai nela
--     (private.box_livre escolhe o setor do público do episódio), e então o
--     painel, o primeiro atendimento, a reavaliação, os sinais do box e a
--     avaliação de enfermagem dão "Acesso negado" (A03 e A05);
--   • a Internação da UPA (…013) só tem o medico.internacao.f5: nenhum
--     enfermeiro escalado nela, e o Fugulin é do "enfermeiro de plantão no
--     setor do paciente" (A04).
--   A escala recusa a mesma pessoa em dois setores no mesmo horário
--   (trg_escala_sem_sobreposicao), então entram contas novas.
--
-- O que entra (ids fora da numeração sequencial, para não colidir com outros
-- scripts de ambiente feitos ao mesmo tempo):
--   • medico.obsped.f5     (…0a1, plantonista na UPA, CRM fictício 950161, CBO 225124)
--   • enfermeiro.obsped.f5 (…0a2, enfermeiro na UPA, CBO 223505)
--   • enfermeiro.internacao.f5 (…0a3, enfermeiro na UPA, CBO 223505)
--   • escala de ontem a daqui a 7 dias, três turnos: as duas primeiras na
--     Observação Pediátrica (…014), a terceira na Internação (…013).
--   Senha: o MESMO hash de medico.upa.f5, copiado no banco (como no 46 e no 48).
--   Nenhuma senha em texto. CNS fictícios com dígito verificador válido.
--
-- Uso: SÓ homologação. Depois, rodar o 41.
--   npx supabase db query --linked -f scripts/e2e/49a_ambiente_bloco_a.sql
-- Reverter: desativar as escalas (ativo = false) e os vínculos dos perfis
-- f5200000-0000-4000-8000-0000000000a1 a …0a3.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.setores WHERE id = 'f5300000-0000-4000-8000-000000000014') THEN
    RAISE EXCEPTION 'Observação Pediátrica ausente: rode antes scripts/e2e/46_rede_fase5_ampliacao.sql.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'medico.upa.f5@teste.local' AND encrypted_password <> '') THEN
    RAISE EXCEPTION 'Conta medico.upa.f5 sem senha: não há hash para copiar.';
  END IF;
END $$;

CREATE TEMP TABLE f5_bloco_a (id uuid, email text, nome text, crm text, cns text, cbo text, setor uuid, papel text) ON COMMIT DROP;
INSERT INTO f5_bloco_a VALUES
  ('f5200000-0000-4000-8000-0000000000a1', 'medico.obsped.f5@teste.local',        'Médica da Observação Pediátrica F5', '950161', '709950000110000', '225124',
   'f5300000-0000-4000-8000-000000000014', 'plantonista'),
  ('f5200000-0000-4000-8000-0000000000a2', 'enfermeiro.obsped.f5@teste.local',    'Enfermeira da Observação Pediátrica F5', NULL, '709950000110108', '223505',
   'f5300000-0000-4000-8000-000000000014', 'enfermeiro'),
  ('f5200000-0000-4000-8000-0000000000a3', 'enfermeiro.internacao.f5@teste.local', 'Enfermeiro da Internação F5',        NULL,     '709950000110205', '223505',
   'f5300000-0000-4000-8000-000000000013', 'enfermeiro');

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email,
       (SELECT u.encrypted_password FROM auth.users u WHERE u.email = 'medico.upa.f5@teste.local'), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('nome_completo', c.nome)::jsonb, now(), now(), '', '', '', ''
  FROM f5_bloco_a c
ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.id::text, json_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true)::jsonb,
       'email', now(), now(), now()
  FROM f5_bloco_a c WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = c.id);
INSERT INTO public.perfis (id, nome_completo, crm, uf_crm, email)
SELECT c.id, c.nome, c.crm, CASE WHEN c.crm IS NOT NULL THEN 'SP' END, c.email FROM f5_bloco_a c
ON CONFLICT (id) DO UPDATE SET nome_completo = excluded.nome_completo, crm = excluded.crm, uf_crm = excluded.uf_crm;
UPDATE public.perfis p SET cns = c.cns, cbo = c.cbo
  FROM f5_bloco_a c WHERE p.id = c.id AND EXISTS (SELECT 1 FROM terminologia.cbo t WHERE t.codigo = c.cbo);

INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
SELECT c.id, 'f5100000-0000-4000-8000-000000000002', c.papel::public.papel FROM f5_bloco_a c
 WHERE NOT EXISTS (SELECT 1 FROM public.vinculos x WHERE x.perfil_id = c.id AND x.unidade_id = 'f5100000-0000-4000-8000-000000000002'
                     AND x.papel = c.papel::public.papel);

INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno)
SELECT 'f5100000-0000-4000-8000-000000000002', c.setor, c.id, d::date, t
  FROM f5_bloco_a c,
       generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, (now() AT TIME ZONE 'America/Sao_Paulo')::date + 7, interval '1 day') d,
       unnest(ARRAY['manha', 'tarde', 'noite']) t
 WHERE NOT EXISTS (SELECT 1 FROM public.escala_plantao x WHERE x.perfil_id = c.id AND x.data = d::date AND x.turno = t AND x.ativo);

COMMIT;

SELECT 'rede F5 ajustada para o bloco A (A02 a A06)' AS situacao,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'f5200000-0000-4000-8000-0000000000a_') AS contas_bloco_a,
       (SELECT count(*) FROM public.escala_plantao WHERE setor_id = 'f5300000-0000-4000-8000-000000000014' AND ativo) AS escalas_obs_pediatrica,
       (SELECT count(*) FROM public.escala_plantao WHERE setor_id = 'f5300000-0000-4000-8000-000000000013' AND ativo
          AND perfil_id = 'f5200000-0000-4000-8000-0000000000a3') AS escalas_enf_internacao;
