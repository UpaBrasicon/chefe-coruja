-- ════════════════════════════════════════════════════════════════════════════
-- Médio M2 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md),
-- saída do fixo. Decisão do RT em 31/10/2026 (opção A, "Encerra a fixa",
-- docs/escala/PROPOSTAS-MEDIOS-M2-M7-M9.md): aprovar a saída do fixo só mudava
-- o status, e a fixa continuava gerando o mês; o banco aceitava "sair da fixa"
-- num plantão que não veio da fixa.
--
-- Correção:
--  1. o pedido de saída do fixo (solicitacoes_escala, tipo 'sair_fixo') só vale
--     para plantão que veio da fixa: existe uma linha ativa de escala_fixa da
--     mesma pessoa, setor, dia da semana e turno (a geração do mês não guarda o
--     vínculo; é a mesma regra que gera o plantão);
--  2. aprovado o pedido, essa linha da fixa é encerrada (ativo = false) e o
--     histórico da escala registra 'fixa_encerrada'. Os meses ainda não gerados
--     deixam de ter o plantão; os plantões já gerados ficam com a pessoa, e o
--     gestor decide cada um. Recusado, nada muda.
-- A falta justificada aprovada só registra, como antes (decisão do RT, opção B).
-- Expand: só funções e gatilhos novos; sem DROP/RENAME de coluna. Idempotente.
-- Teste: supabase/tests/escala_saida_fixo.sql
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_sair_fixo_conferir ON public.solicitacoes_escala;
--   DROP TRIGGER IF EXISTS trg_sair_fixo_aprovado ON public.solicitacoes_escala;
--   DROP FUNCTION IF EXISTS private.sair_fixo_conferir(), private.sair_fixo_aprovado(),
--     private.linha_da_fixa(uuid);
--   (as linhas da fixa já encerradas continuam encerradas; o gestor as reativa na aba Fixa)
-- ════════════════════════════════════════════════════════════════════════════

-- a linha ativa da fixa que gera este plantão (mesma pessoa, setor, dia da semana e turno)
CREATE OR REPLACE FUNCTION private.linha_da_fixa(p_plantao uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT x.id
    FROM public.escala_plantao e
    JOIN public.escala_fixa x
      ON x.unidade_id = e.unidade_id AND x.setor_id = e.setor_id AND x.perfil_id = e.perfil_id
     AND x.turno = e.turno AND x.dia_semana = extract(dow FROM e.data)::int AND x.ativo
   WHERE e.id = p_plantao
   LIMIT 1
$function$;
REVOKE ALL ON FUNCTION private.linha_da_fixa(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.sair_fixo_conferir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF private.linha_da_fixa(NEW.escala_plantao_id) IS NULL THEN
    RAISE EXCEPTION 'Este plantão não veio da escala fixa; para sair dele, passe o plantão ou justifique a falta.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.sair_fixo_conferir() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sair_fixo_conferir ON public.solicitacoes_escala;
CREATE TRIGGER trg_sair_fixo_conferir
  BEFORE INSERT ON public.solicitacoes_escala
  FOR EACH ROW
  WHEN (NEW.tipo = 'sair_fixo')
  EXECUTE FUNCTION private.sair_fixo_conferir();

CREATE OR REPLACE FUNCTION private.sair_fixo_aprovado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_fixa uuid := private.linha_da_fixa(NEW.escala_plantao_id);
BEGIN
  IF v_fixa IS NULL THEN
    RETURN NULL;  -- a linha já foi encerrada ou mudou: nada a encerrar
  END IF;
  UPDATE public.escala_fixa SET ativo = false WHERE id = v_fixa;
  PERFORM private.registrar_historico(NEW.unidade_id, NEW.escala_plantao_id, 'fixa_encerrada',
    'Saída do fixo aprovada: a linha da escala fixa foi encerrada para os próximos meses',
    jsonb_build_object('solicitacao', NEW.id, 'escala_fixa_id', v_fixa, 'perfil_id', NEW.perfil_id,
                       'decidido_por', NEW.decidido_por));
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.sair_fixo_aprovado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sair_fixo_aprovado ON public.solicitacoes_escala;
CREATE TRIGGER trg_sair_fixo_aprovado
  AFTER UPDATE OF status ON public.solicitacoes_escala
  FOR EACH ROW
  WHEN (NEW.tipo = 'sair_fixo' AND OLD.status = 'pendente' AND NEW.status = 'aprovado')
  EXECUTE FUNCTION private.sair_fixo_aprovado();
