-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S3: segundo fator uniforme (decisões do RT T1–T5 = A,
-- 15/11/2026; diagnóstico em docs/seguranca/S3-2FA-UNIFORME-DIAGNOSTICO.md).
--
-- O portão do PostgREST (portao_requisicao) deixa passar GET de tabela e confia
-- na política RESTRICTIVE <tabela>_segundo_fator. Estas tabelas nasceram sem
-- ela e podiam ser lidas com sessão só de senha.
--
-- T1. Política RESTRICTIVE segundo_fator_ok() em 18 tabelas com dado de
--     paciente e no chat (também vale para o Realtime).
-- T2. As duas views SECURITY DEFINER do gestor passam a exigir o segundo fator.
-- T4. Primeiro cadastro do TOTP só depois do código por e-mail (ou dispositivo
--     confiável) nos últimos 15 minutos, no hook de verificação do Auth.
--     (T3, a função de borda clinical-search, fica no código da função.)
--
-- Expand puro: só acrescenta políticas, filtra views e redefine o hook.
-- Reaplicável.
--
-- Rollback (testado na homologação):
--   DO $$ DECLARE t text; BEGIN
--     FOREACH t IN ARRAY ARRAY[<as 19 tabelas abaixo>] LOOP
--       EXECUTE format('DROP POLICY IF EXISTS %1$s_segundo_fator ON public.%1$I', t);
--     END LOOP; END $$;
--   As duas views: recriar sem o WHERE (definição na seção T2).
--   O hook: a definição de 20261003000005_entrada.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── T1. Tabelas ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- clínico
    'teleinterconsultas', 'pedidos_acesso_prontuario', 'reentradas_contingencia',
    'classificacoes_fugulin', 'classificacoes_dini', 'duplas_checagens',
    'eventos_leito', 'chamadas', 'assinaturas', 'destinacoes_prontuario',
    -- farmácia
    'dispensacoes', 'dispensacao_devolucoes', 'movimentos_estoque',
    -- faturamento
    'contas', 'conta_eventos', 'conta_lancamentos', 'conta_versoes_erp',
    -- outros
    'impressoes_pulseira', 'chat_mensagens'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'S3: tabela % não existe aqui, pulada', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %1$s_segundo_fator ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_segundo_fator ON public.%1$I AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok())', t);
  END LOOP;
END $$;

-- ── T2. Views do gestor (SECURITY DEFINER intencional, ver o comentário delas) ─
CREATE OR REPLACE VIEW public.vw_censo_unidade AS
  SELECT unidade_id, unidade_nome, unidade_tipo, total_setores, total_leitos,
         leitos_livres, leitos_ocupados, leitos_bloqueados, leitos_higienizacao
    FROM private.fn_censo_unidade() fn_censo_unidade(unidade_id, unidade_nome, unidade_tipo, total_setores, total_leitos,
                                                     leitos_livres, leitos_ocupados, leitos_bloqueados, leitos_higienizacao)
   WHERE private.segundo_fator_ok();

CREATE OR REPLACE VIEW public.vw_indicadores_unidade AS
  SELECT unidade_id, unidade_nome, total_pacientes, prescricoes_assinadas, prescricoes_rascunho, receitas_retidas
    FROM private.fn_indicadores_unidade() fn_indicadores_unidade(unidade_id, unidade_nome, total_pacientes,
                                                                 prescricoes_assinadas, prescricoes_rascunho, receitas_retidas)
   WHERE private.segundo_fator_ok();

-- ── T4. Hook de verificação do segundo fator ─────────────────────────────────
-- Mesmo hook de 20261003000005 (bloqueio por erros), com uma regra nova: o
-- PRIMEIRO cadastro de um fator TOTP (fator ainda 'unverified') só passa se a
-- pessoa confirmou o código por e-mail (ou um dispositivo confiável) nos
-- últimos 15 minutos. Sem isso, quem tem só a senha cadastrava o próprio
-- aplicativo e virava aal2 sem nunca ver o e-mail. Vale só com o segundo fator
-- exigido na plataforma.
-- Evento: { factor_id, factor_type, user_id, valid }.
CREATE OR REPLACE FUNCTION public.hook_segundo_fator_tentativa(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user   uuid := (event ->> 'user_id')::uuid;
  v_fator  uuid := nullif(event ->> 'factor_id', '')::uuid;
  v_valido boolean := coalesce((event ->> 'valid')::boolean, false);
  v_lim    record;
  v_reg    private.segundo_fator_tentativas%ROWTYPE;
  v_falhas int;
BEGIN
  SELECT * INTO v_lim FROM private.segundo_fator_limite();

  SELECT * INTO v_reg FROM private.segundo_fator_tentativas WHERE user_id = v_user FOR UPDATE;

  -- Bloqueio em curso: nem o código certo passa.
  IF v_reg.bloqueado_ate IS NOT NULL AND v_reg.bloqueado_ate > now() THEN
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'SEGUNDO_FATOR_BLOQUEADO: muitos códigos errados. Tente de novo depois de '
                 || to_char(v_reg.bloqueado_ate AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.');
  END IF;

  IF v_valido THEN
    -- Primeiro cadastro do aplicativo: exige o e-mail confirmado há pouco.
    IF coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'exigir_segundo_fator'), false)
       AND EXISTS (SELECT 1 FROM auth.mfa_factors f
                    WHERE f.id = v_fator AND f.user_id = v_user
                      AND f.factor_type::text = 'totp' AND f.status::text = 'unverified')
       AND NOT EXISTS (SELECT 1 FROM private.segundo_fator_sessao_ok s
                        WHERE s.user_id = v_user AND s.verificado_em > now() - interval '15 minutes') THEN
      RETURN jsonb_build_object(
        'decision', 'reject',
        'message', 'SEGUNDO_FATOR_EMAIL_ANTES: confirme o código enviado por e-mail antes de cadastrar o aplicativo.');
    END IF;
    DELETE FROM private.segundo_fator_tentativas WHERE user_id = v_user;
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  -- Erro: conta dentro da janela; bloqueio vencido ou falha antiga recomeçam do zero.
  v_falhas := CASE
    WHEN v_reg.user_id IS NULL
      OR v_reg.bloqueado_ate IS NOT NULL
      OR v_reg.ultima_falha IS NULL
      OR v_reg.ultima_falha < now() - v_lim.janela THEN 1
    ELSE v_reg.falhas + 1
  END;

  INSERT INTO private.segundo_fator_tentativas AS t (user_id, falhas, ultima_falha, bloqueado_ate)
  VALUES (v_user, v_falhas, now(), CASE WHEN v_falhas >= v_lim.max_falhas THEN now() + v_lim.bloqueio END)
  ON CONFLICT (user_id) DO UPDATE
    SET falhas = excluded.falhas, ultima_falha = excluded.ultima_falha, bloqueado_ate = excluded.bloqueado_ate;

  -- O código já está errado; o Auth recusa sozinho.
  RETURN jsonb_build_object('decision', 'continue');
END; $$;

REVOKE EXECUTE ON FUNCTION public.hook_segundo_fator_tentativa(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_segundo_fator_tentativa(jsonb) TO supabase_auth_admin;
