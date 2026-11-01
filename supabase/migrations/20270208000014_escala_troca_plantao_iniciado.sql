-- ════════════════════════════════════════════════════════════════════════════
-- Bug baixo B12 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md),
-- decisão do RT em 31/10/2026 (opção A, "Passa sim, troca não",
-- docs/escala/BAIXOS-PROPOSTAS-E-REGISTRO.md): a troca de plantão que já
-- começou fica bloqueada; a passagem do plantão em curso continua (é o caso de
-- quem precisa sair no meio do plantão).
--
-- Correção: a função do gatilho do B10 (20270208000013) passa a recusar também
-- o plantão que já começou, e o gatilho vale também na atualização que efetiva
-- a troca: o aceite do colega (aceito_em) e a aprovação (status 'aprovado').
-- Recusar e cancelar continuam livres. O texto do B10 ("já terminou") fica para
-- o plantão encerrado. A passagem não muda.
-- Sem DROP/RENAME de coluna. Idempotente.
-- Teste: supabase/tests/escala_troca_plantao_iniciado.sql
--
-- Rollback (volta ao B10):
--   reaplicar a função e o gatilho de 20270208000013_escala_troca_plantao_passado.sql
--   (CREATE OR REPLACE FUNCTION private.troca_plantao_passado() ... ;
--    DROP TRIGGER IF EXISTS trg_troca_plantao_passado ON public.trocas_plantao;
--    CREATE TRIGGER trg_troca_plantao_passado BEFORE INSERT ON public.trocas_plantao
--      FOR EACH ROW EXECUTE FUNCTION private.troca_plantao_passado();)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.troca_plantao_passado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  -- na atualização, só o aceite do colega e a aprovação conferem os plantões
  IF TG_OP = 'UPDATE'
     AND NOT (NEW.status = 'aprovado' AND OLD.status IS DISTINCT FROM 'aprovado')
     AND NOT (NEW.aceito_em IS NOT NULL AND OLD.aceito_em IS NULL) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e
              WHERE e.id IN (NEW.plantao_a_id, NEW.plantao_b_id) AND e.inicio IS NOT NULL
                AND e.inicio + make_interval(mins => e.duracao_min) <= now()) THEN
    RAISE EXCEPTION 'Um dos plantões da troca já terminou; só se trocam plantões que ainda não terminaram.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e
              WHERE e.id IN (NEW.plantao_a_id, NEW.plantao_b_id) AND e.inicio IS NOT NULL
                AND e.inicio <= now()) THEN
    RAISE EXCEPTION 'Um dos plantões da troca já começou; só se trocam plantões que ainda não começaram. Para sair do plantão em curso, passe o plantão.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.troca_plantao_passado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_troca_plantao_passado ON public.trocas_plantao;
CREATE TRIGGER trg_troca_plantao_passado
  BEFORE INSERT OR UPDATE OF status, aceito_em ON public.trocas_plantao
  FOR EACH ROW EXECUTE FUNCTION private.troca_plantao_passado();
