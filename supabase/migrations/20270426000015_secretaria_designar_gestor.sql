-- ════════════════════════════════════════════════════════════════════════════
-- O gestor da secretaria designa o gestor de uma unidade da sua secretaria
-- (decisão do RT em 25/11/2026, teste de fluxo A, item A-17).
--
-- Uma unidade nova nascia sem caminho para ganhar o primeiro gestor: o convite
-- não dá papel de gestor ("entra pelo contrato da rede") e a troca de papéis
-- (definir_papeis_na_unidade) só vale para quem já está na unidade. O primeiro
-- gestor passa a ser designado pelo gestor da secretaria, na ficha da unidade
-- (Rede da secretaria), escolhendo uma pessoa com conta ativa no app.
--
-- 1. public.secretaria_buscar_contas(p_unidade, p_termo): as contas que podem
--    ser escolhidas. Com e-mail inteiro, a conta ativa com aquele e-mail
--    confirmado (qualquer uma). Com nome (3 letras ou mais), só contas ativas
--    que já têm vínculo em unidade da mesma organização ou são pessoas de uma
--    secretaria dela: a busca por nome não lista contas de outras redes.
-- 2. public.secretaria_designar_gestor(p_unidade, p_perfil): dá (ou reativa) o
--    vínculo de gestor. Não pede CPF nem nascimento: o papel de gestor não
--    exige registro profissional. Grava a auditoria e avisa a pessoa.
--
-- Quem pode: private.secretaria_gere_unidade (pessoa ativa da secretaria ativa
-- da unidade). Ninguém designa a si mesmo. Tirar o gestor continua pela tela
-- Pessoas da unidade (definir_papeis_na_unidade).
--
-- Sem tabela nova. Idempotente (CREATE OR REPLACE).
--
-- Rollback:
--   DROP FUNCTION public.secretaria_designar_gestor(uuid, uuid);
--   DROP FUNCTION public.secretaria_buscar_contas(uuid, text);
--   (os vínculos de gestor já dados ficam; para desfazer um, a tela Pessoas da unidade)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.secretaria_buscar_contas(p_unidade uuid, p_termo text)
RETURNS TABLE(perfil_id uuid, nome text, email text, ja_gestor boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_termo text := lower(btrim(coalesce(p_termo, '')));
  v_org uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.meu_perfil_id() IS NULL OR NOT private.secretaria_gere_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Quem designa o gestor é o gestor da secretaria da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_termo) < 3 THEN RAISE EXCEPTION 'Escreva ao menos 3 letras do nome ou o e-mail inteiro.'; END IF;
  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_unidade;

  RETURN QUERY
  SELECT p.id, p.nome_completo, p.email,
         EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p.id AND v.unidade_id = p_unidade AND v.ativo AND v.papel = 'gestor')
    FROM public.perfis p
    JOIN auth.users a ON a.id = p.id AND a.email_confirmed_at IS NOT NULL
   WHERE p.ativo AND p.id <> private.meu_perfil_id()
     AND CASE
           WHEN v_termo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN lower(a.email) = v_termo
           ELSE position('@' IN v_termo) = 0
                AND lower(p.nome_completo) LIKE '%' || replace(replace(replace(v_termo, '\', '\\'), '%', '\%'), '_', '\_') || '%'
                AND (EXISTS (SELECT 1 FROM public.vinculos v JOIN public.unidades u ON u.id = v.unidade_id
                              WHERE v.perfil_id = p.id AND v.ativo AND u.organizacao_id = v_org)
                     OR EXISTS (SELECT 1 FROM public.secretaria_pessoas sp JOIN public.secretarias s ON s.id = sp.secretaria_id
                                 WHERE sp.perfil_id = p.id AND sp.ativo AND s.organizacao_id = v_org))
         END
   ORDER BY p.nome_completo
   LIMIT 10;
END $$;
REVOKE ALL ON FUNCTION public.secretaria_buscar_contas(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_buscar_contas(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretaria_designar_gestor(p_unidade uuid, p_perfil uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  u public.unidades;
  per public.perfis;
  v_ja boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  IF NOT private.secretaria_gere_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Quem designa o gestor é o gestor da secretaria da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT coalesce(u.ativo, true) THEN RAISE EXCEPTION 'A unidade está inativa.'; END IF;
  IF EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Na unidade Secretaria entram só os papéis de rede.';
  END IF;
  IF p_perfil IS NULL OR p_perfil = v_eu THEN
    RAISE EXCEPTION 'Não é possível designar a si mesmo.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO per FROM public.perfis WHERE id = p_perfil;
  IF NOT FOUND OR NOT per.ativo
     OR NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p_perfil AND a.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Escolha uma pessoa com conta ativa no app.';
  END IF;

  v_ja := EXISTS (SELECT 1 FROM public.vinculos v
                   WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo AND v.papel = 'gestor');
  IF v_ja THEN
    RETURN jsonb_build_object('mudou', false, 'nome', per.nome_completo);
  END IF;

  INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
  VALUES (p_perfil, p_unidade, 'gestor', true, v_eu)
  ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true, criado_por = EXCLUDED.criado_por;

  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  VALUES (p_perfil, p_unidade, private.data_atual(), 'gestor_designado',
          'Você foi designado gestor da ' || u.nome || ' pela gestão da secretaria.')
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();

  PERFORM private.registrar_auditoria('gestor_designado_pela_secretaria', 'vinculos', NULL, p_unidade,
    jsonb_build_object('perfil_id', p_perfil, 'papel', 'gestor', 'secretaria_id', u.secretaria_id));
  RETURN jsonb_build_object('mudou', true, 'nome', per.nome_completo);
END $$;
REVOKE ALL ON FUNCTION public.secretaria_designar_gestor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_designar_gestor(uuid, uuid) TO authenticated;
