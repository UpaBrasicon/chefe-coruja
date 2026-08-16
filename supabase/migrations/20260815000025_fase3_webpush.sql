-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Web Push (T1)
--
-- Armazena a subscription push de cada usuário para envio futuro de notificações
-- no navegador (mesmo com a aba fechada). O envio real via VAPID ficará para o
-- backend/edge function; aqui guardamos a subscription.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_sub_perfil_idx ON public.push_subscriptions (perfil_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_select" ON public.push_subscriptions;
CREATE POLICY "push_sub_select" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.eh_super_admin());

-- RPC: salvar subscription do usuário logado (upsert por endpoint)
CREATE OR REPLACE FUNCTION public.salvar_push_subscription(p_subscription text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_json jsonb;
  v_endpoint text;
BEGIN
  IF p_subscription IS NULL OR p_subscription = '' THEN
    RETURN;
  END IF;
  v_json := p_subscription::jsonb;
  v_endpoint := v_json->>'endpoint';

  INSERT INTO public.push_subscriptions (perfil_id, endpoint, subscription)
  VALUES (auth.uid(), v_endpoint, v_json)
  ON CONFLICT (endpoint) DO UPDATE
    SET subscription = EXCLUDED.subscription,
        perfil_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_push_subscription(text) TO authenticated;
