-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S2 (expand): entrada na conta.
-- Decisões do RT E1–E4 = A, 15/11/2026 (docs/seguranca/S2-ENTRADA-NA-CONTA-DIAGNOSTICO.md).
--
-- E1. Convite:
--   - aceitar_convite_com_limite: confere o código ANTES de aplicar e devolve o
--     resultado sem erro, para a tentativa errada ficar registrada (o erro
--     desfazia a transação e o disjuntor nunca contava). Mesmo bloqueio do
--     conferir_convite (por origem e global) e teto novo por conta (10 por hora).
--     Liberada no portão do segundo fator, como a antiga.
--   - convites novos com 8 caracteres; os de 5 que existem valem até vencer.
-- E2. Contrato:
--   - concluir_adesao recusa quem não confirmou o e-mail;
--   - adesoes_da_organizacao: a lista da tela Pessoas, com "e-mail confirmado";
--   - contratos novos podem ter código mais longo (CT-AAAA-XXXXXX), gerado por
--     private.novo_codigo_contrato(); os CT-AAAA-NNN que existem continuam.
-- A retirada da aceitar_convite antiga é a etapa seguinte (20270414000058).
--
-- Reaplicável. Rollback: as definições anteriores de gerar_convite
-- (20261116000002), conferir_convite e portao_requisicao (20261003000001 e
-- 20261023000001), concluir_adesao (20270414000055); as CHECKs antigas
-- ('^CC-[A-Z0-9]{5}$' e '^CT-[0-9]{4}-[0-9]{3}$'); DROP das funções novas e da
-- tabela private.tentativas_convite_conta.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Formatos dos códigos ─────────────────────────────────────────────────────
ALTER TABLE public.convites DROP CONSTRAINT IF EXISTS convites_codigo_check;
ALTER TABLE public.convites ADD CONSTRAINT convites_codigo_check
  CHECK (codigo ~ '^CC-([A-Z0-9]{5}|[A-Z0-9]{8})$');

ALTER TABLE public.contratos_rede DROP CONSTRAINT IF EXISTS contratos_rede_codigo_check;
ALTER TABLE public.contratos_rede ADD CONSTRAINT contratos_rede_codigo_check
  CHECK (codigo ~ '^CT-[0-9]{4}-([0-9]{3}|[A-Z0-9]{6})$');

-- Código novo de contrato (o super admin cria contratos pelo SQL).
CREATE OR REPLACE FUNCTION private.novo_codigo_contrato()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(6);
  v text := 'CT-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY') || '-';
  i int;
BEGIN
  FOR i IN 0..5 LOOP
    v := v || substr(alfabeto, (get_byte(v_bytes, i) % length(alfabeto)) + 1, 1);
  END LOOP;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION private.novo_codigo_contrato() FROM PUBLIC, anon, authenticated;

-- ── E1. gerar_convite: 8 caracteres (resto igual a 20261116000002) ───────────
CREATE OR REPLACE FUNCTION public.gerar_convite(p_unidade uuid, p_papel public.papel, p_setor uuid DEFAULT NULL,
  p_para_quem text DEFAULT NULL, p_primeiro_plantao_inicio timestamptz DEFAULT NULL, p_primeiro_plantao_fim timestamptz DEFAULT NULL,
  p_validade_dias integer DEFAULT 7)
RETURNS TABLE(id uuid, codigo text, expira_em timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- sem 0/O, 1/I/L
  v_codigo text;
  v_bytes  bytea;
  v_id     uuid;
  v_expira timestamptz;
  v_secretaria boolean;
  i int;
BEGIN
  IF auth.uid() IS NULL OR NOT private.pode_gerir_convites(p_unidade) THEN
    RAISE EXCEPTION 'Só o gestor da unidade gera convite para ela.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_papel IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Gestão e administração entram pelo contrato da rede, não por convite.';
  END IF;
  -- Fase 4, tarefa 12: pessoas de rede, só pelo super admin e só na Secretaria
  v_secretaria := EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade);
  IF private.eh_papel_rede(p_papel::text) THEN
    IF NOT private.eh_super_admin() THEN
      RAISE EXCEPTION 'Pessoas de rede são cadastradas pelo administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT v_secretaria THEN RAISE EXCEPTION 'Papel de rede só na unidade Secretaria da organização.'; END IF;
  ELSIF v_secretaria THEN
    RAISE EXCEPTION 'Na unidade Secretaria entram só os papéis de rede.';
  END IF;
  IF p_setor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.id = p_setor AND s.unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'O setor não é desta unidade.';
  END IF;
  IF p_validade_dias IS NULL OR p_validade_dias NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'A validade do convite vai de 1 a 30 dias.';
  END IF;
  IF p_primeiro_plantao_fim IS NOT NULL AND (p_primeiro_plantao_inicio IS NULL OR p_primeiro_plantao_fim <= p_primeiro_plantao_inicio) THEN
    RAISE EXCEPTION 'O fim do primeiro plantão vem depois do início.';
  END IF;

  v_expira := now() + make_interval(days => p_validade_dias);
  LOOP
    -- S2 (E1): 8 caracteres (31^8, cerca de 850 bilhões)
    v_bytes := extensions.gen_random_bytes(8);
    v_codigo := 'CC-';
    FOR i IN 0..7 LOOP
      v_codigo := v_codigo || substr(alfabeto, (get_byte(v_bytes, i) % length(alfabeto)) + 1, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.convites (codigo, unidade_id, setor_id, papel, para_quem,
                                   primeiro_plantao_inicio, primeiro_plantao_fim, criado_por, expira_em)
      VALUES (v_codigo, p_unidade, p_setor, p_papel, nullif(btrim(p_para_quem), ''),
              p_primeiro_plantao_inicio, p_primeiro_plantao_fim, auth.uid(), v_expira)
      RETURNING convites.id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- código repetido (raro): sorteia outro
    END;
  END LOOP;

  PERFORM private.registrar_auditoria('gerar_convite', 'convites', v_id, p_unidade,
    jsonb_build_object('papel', p_papel, 'setor_id', p_setor));
  RETURN QUERY SELECT v_id, v_codigo, v_expira;
END $$;

-- ── E1. conferir_convite: aceita os dois tamanhos (resto igual) ──────────────
CREATE OR REPLACE FUNCTION public.conferir_convite(p_codigo text)
RETURNS TABLE (
  situacao text, unidade text, setor text, papel public.papel,
  primeiro_plantao_inicio timestamptz, primeiro_plantao_fim timestamptz,
  convidou text, convidou_papel public.papel, expira_em timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  c public.convites%ROWTYPE;
  v_sit text;
BEGIN
  IF private.primeiro_acesso_bloqueado() THEN
    RETURN QUERY SELECT 'muitas_tentativas'::text, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_codigo !~ '^CC-([A-Z0-9]{5}|[A-Z0-9]{8})$' THEN
    PERFORM private.registrar_tentativa_primeiro_acesso();
    RETURN QUERY SELECT 'nao_existe'::text, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.convites WHERE codigo = v_codigo;
  IF NOT FOUND THEN
    PERFORM private.registrar_tentativa_primeiro_acesso();
    RETURN QUERY SELECT 'nao_existe'::text, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;

  v_sit := private.situacao_convite(c.usado_em, c.revogado_em, c.expira_em);
  IF v_sit IN ('usado', 'revogado') THEN
    RETURN QUERY SELECT v_sit, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::public.papel, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_sit = 'expirado' THEN
    RETURN QUERY SELECT v_sit, NULL::text, NULL::text, NULL::public.papel,
      NULL::timestamptz, NULL::timestamptz,
      (SELECT p.nome_completo FROM public.perfis p WHERE p.id = c.criado_por), NULL::public.papel, c.expira_em;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'valido'::text, u.nome, s.nome, c.papel, c.primeiro_plantao_inicio, c.primeiro_plantao_fim,
         p.nome_completo,
         (SELECT v.papel FROM public.vinculos v
           WHERE v.perfil_id = c.criado_por AND v.unidade_id = c.unidade_id AND v.ativo
           ORDER BY (v.papel = 'gestor') DESC LIMIT 1),
         c.expira_em
    FROM public.unidades u
    LEFT JOIN public.setores s ON s.id = c.setor_id
    LEFT JOIN public.perfis p ON p.id = c.criado_por
   WHERE u.id = c.unidade_id;
END $$;

-- ── E1. Aceitar convite com limite ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.tentativas_convite_conta (
  user_id uuid NOT NULL,
  em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tentativas_convite_conta_idx ON private.tentativas_convite_conta (user_id, em DESC);
REVOKE ALL ON private.tentativas_convite_conta FROM PUBLIC, anon, authenticated;

-- Devolve 'ok', 'nao_confere' ou 'muitas_tentativas'. Erros de identidade
-- (CPF, nascimento, registro, termo) continuam como erro, com a mensagem de antes.
CREATE OR REPLACE FUNCTION public.aceitar_convite_com_limite(
  p_codigo          text,
  p_termo_versao    text,
  p_nome_completo   text DEFAULT NULL,
  p_cpf             text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_conselho        text DEFAULT NULL,
  p_registro_numero text DEFAULT NULL,
  p_registro_uf     text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu     uuid := auth.uid();
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  c public.convites%ROWTYPE;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF private.primeiro_acesso_bloqueado()
     OR (SELECT count(*) FROM private.tentativas_convite_conta t
          WHERE t.user_id = v_eu AND t.em > now() - interval '1 hour') >= 10 THEN
    RETURN 'muitas_tentativas';
  END IF;

  SELECT * INTO c FROM public.convites WHERE codigo = v_codigo;
  IF v_codigo !~ '^CC-([A-Z0-9]{5}|[A-Z0-9]{8})$' OR NOT FOUND
     OR private.situacao_convite(c.usado_em, c.revogado_em, c.expira_em) <> 'valido' THEN
    PERFORM private.registrar_tentativa_primeiro_acesso();
    DELETE FROM private.tentativas_convite_conta WHERE em < now() - interval '1 day';
    INSERT INTO private.tentativas_convite_conta (user_id) VALUES (v_eu);
    RETURN 'nao_confere';
  END IF;

  PERFORM private.aplicar_primeiro_acesso(
    v_eu,
    (SELECT u.email FROM auth.users u WHERE u.id = v_eu),
    jsonb_strip_nulls(jsonb_build_object(
      'codigo_convite', v_codigo, 'termo_versao', p_termo_versao,
      'nome_completo', p_nome_completo, 'cpf', p_cpf, 'data_nascimento', p_data_nascimento,
      'conselho', p_conselho, 'registro_numero', p_registro_numero, 'registro_uf', p_registro_uf)));
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.aceitar_convite_com_limite(text, text, text, text, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_convite_com_limite(text, text, text, text, date, text, text, text) TO authenticated;

-- ── Portão do segundo fator: libera a função nova (resto igual) ──────────────
CREATE OR REPLACE FUNCTION public.portao_requisicao()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caminho text;
  v_metodo  text;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'authenticated' THEN
    RETURN;                                   -- anon (painel da TV) e service_role: fora
  END IF;
  IF private.segundo_fator_ok() THEN
    RETURN;                                   -- chave desligada ou 2FA válido
  END IF;
  v_caminho := coalesce(current_setting('request.path', true), '');
  v_metodo  := upper(coalesce(current_setting('request.method', true), ''));
  IF v_caminho LIKE '/rpc/%' THEN
    IF split_part(substr(v_caminho, 6), '?', 1) IN (
         'segundo_fator_status', 'segundo_fator_tentativas',
         'verificar_codigo_2fa', 'verificar_dispositivo_2fa', 'herdar_segundo_fator',
         'usar_codigo_recuperacao',
         'conferir_convite', 'aceitar_convite', 'aceitar_convite_com_limite',
         'horario_servidor', 'data_atual', 'registrar_erro_cliente') THEN
      RETURN;
    END IF;
  ELSIF v_metodo IN ('GET', 'HEAD', 'OPTIONS') THEN
    RETURN;                                   -- leitura de tabela: decide a RLS
  END IF;
  RAISE EXCEPTION 'SEGUNDO_FATOR: confirme o código do segundo fator para continuar.'
    USING ERRCODE = 'insufficient_privilege';
END; $$;
REVOKE ALL ON FUNCTION public.portao_requisicao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portao_requisicao() TO anon, authenticated, service_role;

-- ── E2. Adesão só com e-mail confirmado ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.concluir_adesao(p_adesao uuid, p_unidade uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a  record;
  v_org_unidade uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.exigir_segundo_fator();
  SELECT ad.id, ad.perfil_id, ad.papel, k.organizacao_id, k.ativo
    INTO a
    FROM public.adesoes_contrato ad JOIN public.contratos_rede k ON k.id = ad.contrato_id
   WHERE ad.id = p_adesao;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adesão não encontrada.';
  END IF;
  IF NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(a.organizacao_id)) THEN
    RAISE EXCEPTION 'Só o administrador da organização do contrato conclui esta entrada.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF a.perfil_id = private.meu_perfil_id() AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'A própria entrada é concluída pelo administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT a.ativo THEN
    RAISE EXCEPTION 'O contrato desta adesão não está ativo.';
  END IF;
  -- S2 (E2): o domínio do e-mail foi conferido no cadastro; aqui exige a prova de que o e-mail é da pessoa
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.perfil_id AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'A pessoa ainda não confirmou o e-mail. A entrada é concluída depois da confirmação.';
  END IF;
  SELECT u.organizacao_id INTO v_org_unidade FROM public.unidades u WHERE u.id = p_unidade AND u.ativo;
  IF v_org_unidade IS DISTINCT FROM a.organizacao_id THEN
    RAISE EXCEPTION 'A unidade não é da organização do contrato.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Na unidade Secretaria entram só os papéis de rede.';
  END IF;

  INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
  VALUES (a.perfil_id, p_unidade, a.papel, true, auth.uid())
  ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true
  RETURNING id INTO v_id;

  INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, unidade_id, payload)
  VALUES (auth.uid(), 'adesao_concluida', 'vinculos', v_id, p_unidade,
          private.payload_auditoria('vinculos', jsonb_build_object('perfil_id', a.perfil_id, 'papel', a.papel)));
  RETURN v_id;
END $$;

-- A lista da tela Pessoas, com o estado do e-mail (a tabela auth.users não é legível pelo app).
CREATE OR REPLACE FUNCTION public.adesoes_da_organizacao()
RETURNS TABLE(id uuid, perfil_id uuid, papel public.papel, criado_em timestamptz, organizacao_id uuid, email_confirmado boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ad.id, ad.perfil_id, ad.papel, ad.criado_em, k.organizacao_id,
         EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ad.perfil_id AND u.email_confirmed_at IS NOT NULL)
    FROM public.adesoes_contrato ad JOIN public.contratos_rede k ON k.id = ad.contrato_id
   WHERE auth.uid() IS NOT NULL
     AND (private.eh_super_admin() OR k.organizacao_id IN (SELECT private.orgs_admin()))
   ORDER BY ad.criado_em;
$$;
REVOKE ALL ON FUNCTION public.adesoes_da_organizacao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adesoes_da_organizacao() TO authenticated;
