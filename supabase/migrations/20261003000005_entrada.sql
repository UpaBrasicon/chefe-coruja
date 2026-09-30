-- ════════════════════════════════════════════════════════════════════════════
-- Porte da ENTRADA (login, segundo fator, fora do expediente).
--
-- 1. Tentativas do segundo fator contadas NO SERVIDOR (ADR 0010).
--    O código TOTP é conferido pelo Supabase Auth, não pelo banco. Contar
--    erros na tela não protege nada: quem chama a API direto pula a tela.
--    Por isso a contagem mora no hook "MFA verification attempt" do Auth
--    (config.toml: [auth.hook.mfa_verification_attempt]), que o Auth chama a
--    CADA verificação, certa ou errada, e cuja resposta "reject" derruba a
--    verificação mesmo com o código certo.
--
--    Regra: 3 códigos errados seguidos (dentro de 15 min) bloqueiam o segundo
--    fator da conta por 15 min. Um código certo zera a contagem. Durante o
--    bloqueio, nem o código certo passa.
--
--    Sem o hook ligado no config.toml (e o Auth reiniciado), a tabela fica
--    vazia e nada é bloqueado: a tela mostra só "código não confere".
--
-- 2. meu_proximo_plantao(): o próximo plantão da escala, pelo relógio do
--    servidor, para a tela "Fora do expediente".
--
-- Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tentativas do segundo fator ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS private.segundo_fator_tentativas (
  user_id       uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  falhas        int NOT NULL DEFAULT 0 CHECK (falhas >= 0),
  ultima_falha  timestamptz,
  bloqueado_ate timestamptz
);
REVOKE ALL ON private.segundo_fator_tentativas FROM PUBLIC, anon, authenticated;

-- Parâmetros num lugar só (o hook e a leitura da tela usam os mesmos).
CREATE OR REPLACE FUNCTION private.segundo_fator_limite()
RETURNS TABLE(max_falhas int, janela interval, bloqueio interval)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 3, interval '15 minutes', interval '15 minutes';
$$;

-- Hook do Auth. Evento: { factor_id, factor_type, user_id, valid }.
-- Resposta: { decision: 'continue' | 'reject', message }.
CREATE OR REPLACE FUNCTION public.hook_segundo_fator_tentativa(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user   uuid := (event ->> 'user_id')::uuid;
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

-- Para a tela: quantas tentativas restam e até quando dura o bloqueio.
-- Sessão aal1 (logo depois da senha) já consegue ler: é o próprio usuário.
CREATE OR REPLACE FUNCTION public.segundo_fator_tentativas()
RETURNS TABLE(restantes int, bloqueado_ate timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH lim AS (SELECT * FROM private.segundo_fator_limite()),
       reg AS (SELECT t.* FROM private.segundo_fator_tentativas t WHERE t.user_id = auth.uid())
  SELECT
    CASE
      WHEN r.bloqueado_ate > now() THEN 0
      WHEN r.user_id IS NULL OR r.bloqueado_ate IS NOT NULL OR r.ultima_falha < now() - l.janela THEN l.max_falhas
      ELSE greatest(l.max_falhas - r.falhas, 0)
    END,
    CASE WHEN r.bloqueado_ate > now() THEN r.bloqueado_ate END
  FROM lim l LEFT JOIN reg r ON true
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.segundo_fator_tentativas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.segundo_fator_tentativas() TO authenticated;

-- ── 2. Próximo plantão ──────────────────────────────────────────────────────

-- O primeiro plantão ativo do usuário que ainda não começou, em qualquer
-- unidade (a tela diz a unidade quando não é a ativa). Relógio do servidor.
CREATE OR REPLACE FUNCTION public.meu_proximo_plantao()
RETURNS TABLE(escala_id uuid, unidade_id uuid, unidade_nome text, setor_id uuid, setor_nome text,
              turno text, rotulo text, inicio timestamptz, fim timestamptz, agora timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.id, e.unidade_id, u.nome, e.setor_id, s.nome, e.turno, e.rotulo,
         e.inicio, e.inicio + make_interval(mins => e.duracao_min), now()
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  JOIN public.unidades u ON u.id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND e.inicio > now()
  ORDER BY e.inicio
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.meu_proximo_plantao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meu_proximo_plantao() TO authenticated;
