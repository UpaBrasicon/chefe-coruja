-- ════════════════════════════════════════════════════════════════════════════
-- Médio M9 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md),
-- decisão do RT em 31/10/2026 (opção A, "Pode, com 2º fator",
-- docs/escala/PROPOSTAS-MEDIOS-M2-M7-M9.md): o gestor que também está escalado
-- aprovava a própria passagem ou troca sem 2º fator e sem registro próprio.
--
-- Correção: quem aprova e é parte do pedido (passagem: quem passa ou quem
-- recebe; troca: um dos dois lados) precisa do 2º fator
-- (private.exigir_segundo_fator, como aprovar_candidatura), e o histórico da
-- escala e a auditoria registram 'aprovou_proprio_pedido'. Resolve a unidade
-- com um gestor só. O pedido dos outros continua como antes.
--  * passagem: gatilho novo trg_passagem_propria (BEFORE UPDATE OF status,
--    pendente → aprovado), ao lado do trg_passagem_aprovada do C2;
--  * troca: aprovar_troca (corpo de 20270208000006, A4) ganha a conferência.
-- Vale para quem entra pelo app (há perfil na sessão); o job não é parte.
-- Expand: função e gatilho novos, corpo novo de aprovar_troca (mesma
-- assinatura); sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/escala_aprovacao_propria.sql
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_passagem_propria ON public.solicitacoes_escala;
--   DROP FUNCTION IF EXISTS private.passagem_propria();
--   reaplicar public.aprovar_troca de 20270208000006_escala_aceite_colega.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.passagem_propria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_eu uuid := private.meu_perfil_id();
BEGIN
  IF v_eu IS NULL OR v_eu NOT IN (NEW.perfil_id, coalesce(NEW.destino_perfil_id, NEW.perfil_id)) THEN
    RETURN NEW;
  END IF;
  PERFORM private.exigir_segundo_fator();
  PERFORM private.registrar_historico(NEW.unidade_id, NEW.escala_plantao_id, 'aprovou_proprio_pedido',
    'O gestor aprovou a própria passagem (com 2º fator)',
    jsonb_build_object('solicitacao', NEW.id, 'perfil_id', NEW.perfil_id, 'destino', NEW.destino_perfil_id));
  PERFORM private.registrar_auditoria('aprovou_proprio_pedido', 'solicitacoes_escala', NEW.id, NEW.unidade_id,
    jsonb_build_object('tipo', NEW.tipo, 'perfil_id', NEW.perfil_id, 'destino', NEW.destino_perfil_id));
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.passagem_propria() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_passagem_propria ON public.solicitacoes_escala;
CREATE TRIGGER trg_passagem_propria
  BEFORE UPDATE OF status ON public.solicitacoes_escala
  FOR EACH ROW
  WHEN (NEW.tipo = 'passar_plantao' AND OLD.status = 'pendente' AND NEW.status = 'aprovado')
  EXECUTE FUNCTION private.passagem_propria();

-- Corpo de 20270208000006 (A4): entra a conferência do próprio pedido (M9).
CREATE OR REPLACE FUNCTION public.aprovar_troca(p_troca uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_t public.trocas_plantao%ROWTYPE;
  v_proprio boolean;
BEGIN
  SELECT * INTO v_t FROM public.trocas_plantao WHERE id = p_troca;
  IF v_t.id IS NULL THEN
    RAISE EXCEPTION 'Troca não encontrada';
  END IF;
  IF v_t.status <> 'pendente' THEN
    RAISE EXCEPTION 'Troca não está pendente';
  END IF;
  -- A2: só o gestor da unidade (ou o super admin) põe a troca na escala
  IF NOT (private.papel_na_unidade(v_t.unidade_id) = 'gestor' OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Só o gestor da unidade aprova a troca. O colega pode recusar.';
  END IF;
  -- A4: depois do aceite do colega
  IF v_t.aceito_em IS NULL THEN
    RAISE EXCEPTION 'O colega ainda não aceitou a troca. Espere o aceite ou recuse o pedido.';
  END IF;
  -- M9: o próprio pedido só com o 2º fator, e fica registrado
  v_proprio := v_perfil IN (v_t.perfil_a_id, v_t.perfil_b_id);
  IF v_proprio THEN
    PERFORM private.exigir_segundo_fator();
  END IF;
  PERFORM private.efetivar_troca(p_troca, v_perfil);
  IF v_proprio THEN
    PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_a_id, 'aprovou_proprio_pedido',
      'O gestor aprovou a própria troca (com 2º fator)', jsonb_build_object('troca_id', p_troca));
    PERFORM private.registrar_historico(v_t.unidade_id, v_t.plantao_b_id, 'aprovou_proprio_pedido',
      'O gestor aprovou a própria troca (com 2º fator)', jsonb_build_object('troca_id', p_troca));
    PERFORM private.registrar_auditoria('aprovou_proprio_pedido', 'trocas_plantao', p_troca, v_t.unidade_id,
      jsonb_build_object('perfil_a', v_t.perfil_a_id, 'perfil_b', v_t.perfil_b_id));
  END IF;
END;
$function$;
