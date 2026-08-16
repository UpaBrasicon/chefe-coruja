-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3 — Notificações de turno (plantonistas)
--
-- Avisos in-app para o plantonista que está NA ESCALA, nos horários de
-- transição, sobre os pacientes internados/em observação:
--   • Turno da NOITE (19h–07h): avisos às 19:30 e 20:00.
--   • Transição noite → dia (manhã 07h–13h): avisos às 07:30 e 08:00.
--
-- Cada aviso é gerado uma única vez por data (UNIQUE) e marcado como lido
-- quando o usuário fecha o banner.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notificacoes_plantonista (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  data        date NOT NULL,
  tipo        text NOT NULL, -- noite_1930, noite_2000, manha_0730, manha_0800
  mensagem    text NOT NULL,
  lida_em     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, unidade_id, data, tipo)
);
CREATE INDEX IF NOT EXISTS notif_plantonista_perfil_idx ON public.notificacoes_plantonista (perfil_id, data, lida_em);

ALTER TABLE public.notificacoes_plantonista ENABLE ROW LEVEL SECURITY;

-- Só o próprio plantonista (ou super) vê/edita as próprias notificações
DROP POLICY IF EXISTS "notif_plantonista_select" ON public.notificacoes_plantonista;
CREATE POLICY "notif_plantonista_select" ON public.notificacoes_plantonista
  FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.eh_super_admin());

DROP POLICY IF EXISTS "notif_plantonista_insert" ON public.notificacoes_plantonista;
CREATE POLICY "notif_plantonista_insert" ON public.notificacoes_plantonista
  FOR INSERT TO authenticated
  WITH CHECK (perfil_id = private.meu_perfil_id() OR private.eh_super_admin());

DROP POLICY IF EXISTS "notif_plantonista_update" ON public.notificacoes_plantonista;
CREATE POLICY "notif_plantonista_update" ON public.notificacoes_plantonista
  FOR UPDATE TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.eh_super_admin())
  WITH CHECK (perfil_id = private.meu_perfil_id() OR private.eh_super_admin());

DROP POLICY IF EXISTS "notif_plantonista_delete" ON public.notificacoes_plantonista;
CREATE POLICY "notif_plantonista_delete" ON public.notificacoes_plantonista
  FOR DELETE TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.eh_super_admin());

-- ── RPC: gerar notificações do turno atual (chamado pelo cliente a cada minuto) ─
CREATE OR REPLACE FUNCTION public.gerar_notificacoes_turno(p_unidade uuid)
RETURNS TABLE (id uuid, tipo text, mensagem text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hora   time;
  v_turno  text;
  v_tipo   text;
  v_msg    text;
BEGIN
  -- Só quem está na escala agora (ou super) recebe
  IF NOT private.na_escala_agora(p_unidade) AND NOT private.eh_super_admin() THEN
    RETURN;
  END IF;

  v_hora := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_turno := private.turno_atual();

  -- TURNO DA NOITE (19h–07h): avisos às 19:30 e 20:00
  IF v_turno = 'noite' THEN
    IF v_hora >= time '19:30' AND v_hora < time '19:59' THEN
      v_tipo := 'noite_1930';
      v_msg := 'Você é o plantonista da noite. Confira os pacientes internados e em observação que estão sob sua responsabilidade.';
    ELSIF v_hora >= time '20:00' THEN
      v_tipo := 'noite_2000';
      v_msg := 'Plantão noturno em andamento. Verifique os pacientes internados e em observação da sua escala.';
    END IF;
  END IF;

  -- TRANSIÇÃO noite → dia (manhã 07h–13h): avisos às 07:30 e 08:00
  IF v_turno = 'manha' THEN
    IF v_hora >= time '07:30' AND v_hora < time '07:59' THEN
      v_tipo := 'manha_0730';
      v_msg := 'Bom dia! Assuma os pacientes internados e em observação do plantão da manhã.';
    ELSIF v_hora >= time '08:00' THEN
      v_tipo := 'manha_0800';
      v_msg := 'Plantão da manhã em andamento. Confira os pacientes internados e em observação.';
    END IF;
  END IF;

  IF v_tipo IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (auth.uid(), p_unidade, private.data_atual(), v_tipo, v_msg)
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END IF;

  RETURN QUERY
    SELECT n.id, n.tipo, n.mensagem, n.created_at
    FROM public.notificacoes_plantonista n
    WHERE n.perfil_id = auth.uid()
      AND n.unidade_id = p_unidade
      AND n.data = private.data_atual()
      AND n.lida_em IS NULL
    ORDER BY n.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_notificacoes_turno(uuid) TO authenticated;

-- ── RPC: marcar notificação como lida ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.notificacoes_plantonista
  SET lida_em = now()
  WHERE id = p_id AND perfil_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.marcar_notificacao_lida(uuid) TO authenticated;
