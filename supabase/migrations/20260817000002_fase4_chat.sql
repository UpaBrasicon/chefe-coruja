-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4 — Chat lateral em tempo real (plantonistas, gestão e suporte)
--
-- Modelo: conversas 1:1 privadas por participação, com contador de não lidas
-- via ultima_leitura_em. Soft delete (15 min) preserva auditoria.
-- Suporte = super_admins; admin NÃO tem acesso a nenhuma tabela de chat.
-- RLS fail closed; funções SECURITY DEFINER com SET search_path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ===========================================================================
-- 1. Conversas
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.conversas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE, -- NULL = suporte
  tipo       text NOT NULL DEFAULT 'direta'
             CHECK (tipo IN ('direta', 'suporte', 'gestao')),
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversas_unidade ON public.conversas (unidade_id);
CREATE INDEX IF NOT EXISTS idx_conversas_tipo ON public.conversas (tipo);

ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

-- 2. Participantes
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.conversa_participantes (
  conversa_id        uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  perfil_id          uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  entrou_em          timestamptz NOT NULL DEFAULT now(),
  ultima_leitura_em  timestamptz,
  PRIMARY KEY (conversa_id, perfil_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_part_perfil ON public.conversa_participantes (perfil_id);

ALTER TABLE public.conversa_participantes ENABLE ROW LEVEL SECURITY;

-- Participante vê as próprias linhas; super vê participantes das conversas de suporte
DROP POLICY IF EXISTS "conv_part_select" ON public.conversa_participantes;
CREATE POLICY "conv_part_select" ON public.conversa_participantes
  FOR SELECT TO authenticated
  USING (
    perfil_id = private.meu_perfil_id()
    OR private.eh_super_admin()
  );

-- Escrita apenas via RPCs SECURITY DEFINER
DROP POLICY IF EXISTS "conv_part_insert" ON public.conversa_participantes;
CREATE POLICY "conv_part_insert" ON public.conversa_participantes
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "conv_part_update" ON public.conversa_participantes;
CREATE POLICY "conv_part_update" ON public.conversa_participantes
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

-- ===========================================================================
-- Visível apenas a participantes da conversa (ou super p/ suporte)
DROP POLICY IF EXISTS "conversas_select" ON public.conversas;
CREATE POLICY "conversas_select" ON public.conversas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversa_participantes cp
      WHERE cp.conversa_id = conversas.id
        AND cp.perfil_id = private.meu_perfil_id()
    )
    OR (conversas.tipo = 'suporte' AND private.eh_super_admin())
  );

-- Criação de conversas apenas via RPCs SECURITY DEFINER (valida vínculo/participantes)
DROP POLICY IF EXISTS "conversas_insert" ON public.conversas;
CREATE POLICY "conversas_insert" ON public.conversas
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ===========================================================================
-- 3. Mensagens
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  autor_id    uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  corpo       text NOT NULL CHECK (length(corpo) BETWEEN 1 AND 4000),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  editado_em  timestamptz,
  excluida    boolean NOT NULL DEFAULT false -- soft delete: corpo apagado, linha preservada
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conversa ON public.chat_mensagens (conversa_id, criado_em);

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas participante da conversa (com vínculo ativo na unidade da conversa)
DROP POLICY IF EXISTS "chat_msg_select" ON public.chat_mensagens;
CREATE POLICY "chat_msg_select" ON public.chat_mensagens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversa_participantes cp
      WHERE cp.conversa_id = chat_mensagens.conversa_id
        AND cp.perfil_id = private.meu_perfil_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = chat_mensagens.conversa_id
        AND c.tipo = 'suporte'
        AND private.eh_super_admin()
    )
  );

-- INSERT: participante E vínculo ativo na unidade da conversa (ou super p/ suporte)
DROP POLICY IF EXISTS "chat_msg_insert" ON public.chat_mensagens;
CREATE POLICY "chat_msg_insert" ON public.chat_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversa_participantes cp
      JOIN public.conversas c ON c.id = cp.conversa_id
      WHERE cp.conversa_id = chat_mensagens.conversa_id
        AND cp.perfil_id = private.meu_perfil_id()
        AND (
          c.unidade_id IS NOT NULL
          AND c.unidade_id IN (SELECT private.unidades_gestor_plantonista())
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = chat_mensagens.conversa_id
        AND c.tipo = 'suporte'
        AND private.eh_super_admin()
    )
  );

-- UPDATE: só o autor, janela de 15 min; apenas editar corpo ou marcar excluida
DROP POLICY IF EXISTS "chat_msg_update" ON public.chat_mensagens;
CREATE POLICY "chat_msg_update" ON public.chat_mensagens
  FOR UPDATE TO authenticated
  USING (
    autor_id = private.meu_perfil_id()
    AND criado_em > now() - interval '15 minutes'
  )
  WITH CHECK (
    autor_id = private.meu_perfil_id()
    AND criado_em > now() - interval '15 minutes'
  );

-- ===========================================================================
-- 4. RPCs (SECURITY DEFINER + SET search_path)
-- ===========================================================================

-- Cria/retorna a conversa 1:1 entre o usuário e o destinatário na unidade ativa
CREATE OR REPLACE FUNCTION public.abrir_conversa_direta(p_destinatario_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_conversa uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF p_destinatario_id IS NULL OR p_destinatario_id = v_perfil THEN
    RAISE EXCEPTION 'Destinatário inválido';
  END IF;

  -- unidade ativa do usuário (qualquer vínculo ativo — plantonista/gestor)
  SELECT v.unidade_id INTO v_unidade
  FROM public.vinculos v
  WHERE v.perfil_id = v_perfil AND v.ativo
  ORDER BY v.created_at LIMIT 1;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Usuário sem unidade ativa'; END IF;

  -- destinatário deve ter vínculo ativo na mesma unidade
  IF NOT EXISTS (
    SELECT 1 FROM public.vinculos v
    WHERE v.perfil_id = p_destinatario_id AND v.unidade_id = v_unidade AND v.ativo
  ) THEN
    RAISE EXCEPTION 'Destinatário não pertence à sua unidade';
  END IF;

  -- busca conversa 1:1 existente (dois participantes, ambos nesta unidade)
  SELECT c.id INTO v_conversa
  FROM public.conversas c
  JOIN public.conversa_participantes cp1 ON cp1.conversa_id = c.id AND cp1.perfil_id = v_perfil
  JOIN public.conversa_participantes cp2 ON cp2.conversa_id = c.id AND cp2.perfil_id = p_destinatario_id
  WHERE c.unidade_id = v_unidade AND c.tipo = 'direta'
  LIMIT 1;

  IF v_conversa IS NULL THEN
    INSERT INTO public.conversas (unidade_id, tipo) VALUES (v_unidade, 'direta')
    RETURNING id INTO v_conversa;
    INSERT INTO public.conversa_participantes (conversa_id, perfil_id, ultima_leitura_em)
    VALUES (v_conversa, v_perfil, now());
    INSERT INTO public.conversa_participantes (conversa_id, perfil_id)
    VALUES (v_conversa, p_destinatario_id);
    PERFORM private.registrar_auditoria('chat_conversa_aberta', 'conversas', v_conversa,
      v_unidade, jsonb_build_object('destinatario', p_destinatario_id));
  END IF;

  RETURN v_conversa;
END;
$$;

-- Cria/retorna a conversa do usuário com o suporte
CREATE OR REPLACE FUNCTION public.abrir_conversa_suporte()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_conversa uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT c.id INTO v_conversa
  FROM public.conversas c
  JOIN public.conversa_participantes cp ON cp.conversa_id = c.id AND cp.perfil_id = v_perfil
  WHERE c.tipo = 'suporte'
  LIMIT 1;

  IF v_conversa IS NULL THEN
    INSERT INTO public.conversas (unidade_id, tipo) VALUES (NULL, 'suporte')
    RETURNING id INTO v_conversa;
    INSERT INTO public.conversa_participantes (conversa_id, perfil_id, ultima_leitura_em)
    VALUES (v_conversa, v_perfil, now());
  END IF;

  RETURN v_conversa;
END;
$$;

-- Marca a conversa como lida (atualiza ultima_leitura_em)
CREATE OR REPLACE FUNCTION public.marcar_lida(p_conversa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF v_perfil IS NULL THEN RETURN; END IF;
  UPDATE public.conversa_participantes
    SET ultima_leitura_em = now()
    WHERE conversa_id = p_conversa_id AND perfil_id = v_perfil;
END;
$$;

-- Lista conversas do usuário com última mensagem, não lidas e interlocutor
CREATE OR REPLACE FUNCTION public.listar_conversas()
RETURNS TABLE (
  conversa_id uuid,
  tipo text,
  unidade_id uuid,
  unidade_nome text,
  interlocutor_id uuid,
  interlocutor_nome text,
  interlocutor_foto text,
  interlocutor_papel text,
  ultima_mensagem text,
  ultima_data timestamptz,
  nao_lidas bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.tipo,
    c.unidade_id,
    u.nome AS unidade_nome,
    outro.id AS interlocutor_id,
    outro.nome_completo AS interlocutor_nome,
    outro.foto_url AS interlocutor_foto,
    (SELECT v.papel::text FROM public.vinculos v
      WHERE v.perfil_id = outro.id AND v.ativo
      ORDER BY CASE v.papel WHEN 'admin' THEN 0 WHEN 'gestor' THEN 1 WHEN 'plantonista' THEN 2 END
      LIMIT 1) AS interlocutor_papel,
    (CASE WHEN um.excluida THEN '(mensagem excluída)' ELSE um.corpo END) AS ultima_mensagem,
    um.criado_em AS ultima_data,
    (SELECT count(*) FROM public.chat_mensagens m
      WHERE m.conversa_id = c.id
        AND m.criado_em > coalesce(cp.ultima_leitura_em, '1970-01-01')
        AND m.autor_id <> v_perfil
        AND NOT m.excluida) AS nao_lidas
  FROM public.conversas c
  JOIN public.conversa_participantes cp ON cp.conversa_id = c.id AND cp.perfil_id = v_perfil
  LEFT JOIN public.unidades u ON u.id = c.unidade_id
  LEFT JOIN LATERAL (
    SELECT p.id, p.nome_completo, p.foto_url
    FROM public.conversa_participantes cp2
    JOIN public.perfis p ON p.id = cp2.perfil_id
    WHERE cp2.conversa_id = c.id AND cp2.perfil_id <> v_perfil
    LIMIT 1
  ) outro ON true
  LEFT JOIN LATERAL (
    SELECT m.corpo, m.criado_em, m.excluida
    FROM public.chat_mensagens m
    WHERE m.conversa_id = c.id
    ORDER BY m.criado_em DESC
    LIMIT 1
  ) um ON true
  ORDER BY coalesce(um.criado_em, c.criado_em) DESC;
END;
$$;

-- Contatos do chat: plantonistas DE PLANTÃO AGORA + gestores da unidade
CREATE OR REPLACE FUNCTION public.contatos_chat()
RETURNS TABLE (
  perfil_id uuid,
  nome text,
  foto text,
  papel text,
  setor_nome text,
  em_plantao boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  RETURN QUERY
  -- Plantonistas de plantão agora (escala dedicada, relógio do servidor)
  SELECT DISTINCT
    p.id,
    p.nome_completo,
    p.foto_url,
    'plantonista'::text,
    s.nome,
    true
  FROM public.escala_plantao e
  JOIN public.perfis p ON p.id = e.perfil_id
  JOIN public.setores s ON s.id = e.setor_id
  JOIN public.vinculos v ON v.perfil_id = p.id AND v.unidade_id = e.unidade_id AND v.ativo
  WHERE e.ativo
    AND e.data = private.data_atual()
    AND e.turno = private.turno_atual()
    AND e.unidade_id IN (SELECT v2.unidade_id FROM public.vinculos v2
      WHERE v2.perfil_id = v_perfil AND v2.ativo)

  UNION ALL

  -- Gestores da unidade ativa do usuário
  SELECT DISTINCT
    p.id,
    p.nome_completo,
    p.foto_url,
    'gestor'::text,
    NULL::text,
    false
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  WHERE v.papel = 'gestor' AND v.ativo
    AND v.unidade_id IN (SELECT v2.unidade_id FROM public.vinculos v2
      WHERE v2.perfil_id = v_perfil AND v2.ativo)
    AND p.id <> v_perfil
  ORDER BY nome;
END;
$$;

-- Envia mensagem (valida participação + vínculo; registra auditoria e notificação)
CREATE OR REPLACE FUNCTION public.enviar_mensagem(p_conversa_id uuid, p_corpo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_msg uuid;
  v_unidade uuid;
  v_destino uuid;
  v_autor_nome text;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF p_corpo IS NULL OR length(trim(p_corpo)) = 0 THEN
    RAISE EXCEPTION 'Mensagem vazia';
  END IF;
  IF length(p_corpo) > 4000 THEN
    RAISE EXCEPTION 'Mensagem excede 4000 caracteres';
  END IF;

  -- valida participação
  IF NOT EXISTS (
    SELECT 1 FROM public.conversa_participantes cp
    WHERE cp.conversa_id = p_conversa_id AND cp.perfil_id = v_perfil
  ) THEN
    RAISE EXCEPTION 'Você não participa desta conversa';
  END IF;

  SELECT c.unidade_id INTO v_unidade FROM public.conversas c WHERE c.id = p_conversa_id;
  IF v_unidade IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vinculos v WHERE v.perfil_id = v_perfil AND v.unidade_id = v_unidade AND v.ativo
  ) THEN
    RAISE EXCEPTION 'Vínculo inativo na unidade da conversa';
  END IF;

  INSERT INTO public.chat_mensagens (conversa_id, autor_id, corpo)
  VALUES (p_conversa_id, v_perfil, trim(p_corpo))
  RETURNING id INTO v_msg;

  SELECT nome_completo INTO v_autor_nome FROM public.perfis WHERE id = v_perfil;
  PERFORM private.registrar_auditoria('chat_mensagem_enviada', 'chat_mensagens', v_msg,
    v_unidade, jsonb_build_object('conversa', p_conversa_id));

  -- notificação in-app para o(s) outro(s) participante(s)
  SELECT cp.perfil_id INTO v_destino
  FROM public.conversa_participantes cp
  WHERE cp.conversa_id = p_conversa_id AND cp.perfil_id <> v_perfil
  LIMIT 1;

  IF v_destino IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_destino, v_unidade, current_date, 'chat_' || p_conversa_id,
      'Nova mensagem de ' || coalesce(v_autor_nome, 'um colega'))
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
      SET mensagem = EXCLUDED.mensagem, lida_em = NULL;
  END IF;

  RETURN v_msg;
END;
$$;

-- Edita a própria mensagem (janela de 15 min)
CREATE OR REPLACE FUNCTION public.editar_mensagem(p_mensagem_id uuid, p_corpo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF p_corpo IS NULL OR length(trim(p_corpo)) = 0 OR length(p_corpo) > 4000 THEN
    RAISE EXCEPTION 'Corpo inválido';
  END IF;
  UPDATE public.chat_mensagens
    SET corpo = trim(p_corpo), editado_em = now()
    WHERE id = p_mensagem_id AND autor_id = v_perfil
      AND criado_em > now() - interval '15 minutes';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível editar (apenas autor, dentro de 15 min)';
  END IF;
END;
$$;

-- Soft delete da própria mensagem (janela de 15 min)
CREATE OR REPLACE FUNCTION public.excluir_mensagem(p_mensagem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  UPDATE public.chat_mensagens
    SET excluida = true, corpo = '', editado_em = now()
    WHERE id = p_mensagem_id AND autor_id = v_perfil
      AND criado_em > now() - interval '15 minutes';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível excluir (apenas autor, dentro de 15 min)';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_conversa_direta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_conversa_suporte() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_lida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_conversas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.contatos_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_mensagem(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_mensagem(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_mensagem(uuid) TO authenticated;

-- ===========================================================================
-- 5. Realtime (publicação supabase_realtime)
-- ===========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversa_participantes;
