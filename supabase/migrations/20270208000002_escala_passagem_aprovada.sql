-- ════════════════════════════════════════════════════════════════════════════
-- Bug crítico C2 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- a passagem aprovada pelo gestor não mudava o plantão de dono. A tela do gestor
-- (Escala.tsx, mutação decidir) só grava status = 'aprovado' em
-- solicitacoes_escala, e não havia RPC nem gatilho que aplicasse a passagem:
-- o pedido ficava "aprovado" e o plantão continuava com quem passou.
--
-- Correção: um gatilho em solicitacoes_escala aplica a passagem quando o pedido
-- passa de pendente para aprovado, venha a aprovação de onde vier (a tela de
-- hoje, sem mudança, ou uma RPC futura). Antes de aplicar, confere:
--  * o plantão ainda está ativo e é de quem pediu;
--  * o destino tem vínculo ativo na unidade;
--  * o destino não tem plantão no mesmo setor e horário.
-- A categoria e a sobreposição em outro setor são conferidas pelos gatilhos de
-- escala_plantao (trg_escala_categoria, trg_escala_sem_sobreposicao) no UPDATE do
-- dono. Se algo falhar, a aprovação inteira volta: o pedido continua pendente e
-- o gestor recebe a mensagem. A passagem aplicada vai para historico_escala.
--
-- Expand: só cria função e gatilho; nenhuma coluna, política ou grant muda.
-- Idempotente (CREATE OR REPLACE, DROP TRIGGER IF EXISTS antes do CREATE).
-- Teste: supabase/tests/escala_passagem_aprovada.sql
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_passagem_aprovada ON public.solicitacoes_escala;
--   DROP FUNCTION IF EXISTS private.passagem_aprovada();
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.passagem_aprovada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = NEW.escala_plantao_id AND ativo;
  IF v_pl.id IS NULL THEN
    RAISE EXCEPTION 'O plantão da passagem não está mais ativo.';
  END IF;
  IF v_pl.perfil_id IS DISTINCT FROM NEW.perfil_id THEN
    RAISE EXCEPTION 'A passagem não confere com a escala: o plantão não é mais de quem pediu. Recuse o pedido.';
  END IF;
  IF NEW.destino_perfil_id IS NULL OR NEW.destino_perfil_id = v_pl.perfil_id THEN
    RAISE EXCEPTION 'A passagem não tem destino válido. Recuse o pedido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = NEW.destino_perfil_id AND v.unidade_id = v_pl.unidade_id AND v.ativo) THEN
    RAISE EXCEPTION 'O destino não tem vínculo ativo nesta unidade.';
  END IF;
  IF private.tem_conflito_plantao(NEW.destino_perfil_id, v_pl.unidade_id, v_pl.setor_id, v_pl.data, v_pl.turno, v_pl.id) THEN
    RAISE EXCEPTION 'Conflito de horário: o destino já tem plantão no mesmo horário.';
  END IF;

  UPDATE public.escala_plantao
     SET perfil_id = NEW.destino_perfil_id, updated_at = now()
   WHERE id = v_pl.id;

  PERFORM private.registrar_historico(v_pl.unidade_id, v_pl.id, 'passagem_aplicada',
    'Passagem aprovada pelo gestor',
    jsonb_build_object('solicitacao', NEW.id, 'de', v_pl.perfil_id, 'para', NEW.destino_perfil_id,
                       'decidido_por', NEW.decidido_por));
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.passagem_aprovada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_passagem_aprovada ON public.solicitacoes_escala;
CREATE TRIGGER trg_passagem_aprovada
  BEFORE UPDATE OF status ON public.solicitacoes_escala
  FOR EACH ROW
  WHEN (NEW.tipo = 'passar_plantao' AND OLD.status = 'pendente' AND NEW.status = 'aprovado')
  EXECUTE FUNCTION private.passagem_aprovada();
