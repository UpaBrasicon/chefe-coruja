-- ════════════════════════════════════════════════════════════════════════════
-- Primeiro super admin da HOMOLOGAÇÃO (Fase 0, tarefa 2).
--
-- 1. No painel do projeto de homologação (URL com puzivzsfyheiqjqyibhk):
--    Authentication → Users → Add user → e-mail + senha (escolhida por você,
--    nunca a mesma da produção) → marcar "Auto Confirm User".
-- 2. Trocar o e-mail abaixo e rodar este arquivo no SQL Editor do MESMO projeto.
--
-- O perfil já nasce pelo gatilho de cadastro; aqui só se confere e promove.
-- Idempotente. Não roda se o banco tiver a organização de produção.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_email text := 'TROQUE-PELO-SEU-EMAIL@exemplo.com';
  v_id uuid;
BEGIN
  IF v_email LIKE 'TROQUE%' THEN
    RAISE EXCEPTION 'Troque o e-mail na linha v_email antes de rodar.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizacoes WHERE id = '30000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a organização do seed-homolog.sql). Confira a URL do painel.';
  END IF;
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Usuário % não existe: crie em Authentication → Users → Add user.', v_email;
  END IF;
  INSERT INTO public.perfis (id, nome_completo, email)
  VALUES (v_id, split_part(v_email, '@', 1), v_email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.super_admins (perfil_id) VALUES (v_id) ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Super admin de homologação: % (%)', v_email, v_id;
END $$;
