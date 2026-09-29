-- Testes da migration 20261002000002_chat_farmaceutico.sql
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_chat_farmaceutico.sql
--
-- Cria um farmacêutico (…0007) na Unidade Teste e confere que o gestor (…0001)
-- o encontra nos contatos do chat, que o farmacêutico não vê a si mesmo, e que
-- um farmacêutico de outra unidade não aparece.
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'farm-teste@teste.local', '', now(), '{}', '{"nome_completo":"Farmacêutica de Teste"}', now(), now()),
       ('10000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'farm-outra@teste.local', '', now(), '{}', '{"nome_completo":"Farmacêutico de Outra Unidade"}', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO public.perfis (id, nome_completo)
VALUES ('10000000-0000-4000-8000-000000000007', 'Farmacêutica de Teste'),
       ('10000000-0000-4000-8000-000000000008', 'Farmacêutico de Outra Unidade')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo)
VALUES ('10000000-0000-4000-8000-000000000007', '21000000-0000-4000-8000-000000000001', 'farmaceutico', true);

-- outra unidade, sem vínculo do gestor
INSERT INTO public.unidades (id, organizacao_id, nome, tipo)
SELECT '21000000-0000-4000-8000-000000000099', u.organizacao_id, 'Unidade Sem Vínculo', u.tipo
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo)
VALUES ('10000000-0000-4000-8000-000000000008', '21000000-0000-4000-8000-000000000099', 'farmaceutico', true);

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. o gestor encontra o farmacêutico da sua unidade ──────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.contatos_chat() c
                 WHERE c.perfil_id = '10000000-0000-4000-8000-000000000007' AND c.papel = 'farmaceutico') THEN
    RAISE EXCEPTION 'FALHOU: farmacêutico da unidade não aparece nos contatos do gestor';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contatos_chat() c WHERE c.perfil_id = '10000000-0000-4000-8000-000000000008') THEN
    RAISE EXCEPTION 'FALHOU: farmacêutico de outra unidade aparece nos contatos';
  END IF;
  RAISE NOTICE 'OK  gestor vê o farmacêutico da própria unidade, e só ele';
END $$;

-- ── 2. o farmacêutico não é contato de si mesmo e vê o gestor ───────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000007');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.contatos_chat() c WHERE c.perfil_id = '10000000-0000-4000-8000-000000000007') THEN
    RAISE EXCEPTION 'FALHOU: farmacêutico aparece como contato de si mesmo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contatos_chat() c WHERE c.perfil_id = '10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: farmacêutico não encontra o gestor';
  END IF;
  RAISE NOTICE 'OK  farmacêutico encontra o gestor e não a si mesmo';
END $$;

ROLLBACK;
