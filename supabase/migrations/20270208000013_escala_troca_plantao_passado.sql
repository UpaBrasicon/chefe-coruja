-- ════════════════════════════════════════════════════════════════════════════
-- Bug baixo B10 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- a troca listava e aceitava plantões que já tinham passado (o meu e o do
-- colega). Trocar plantão encerrado mexe no registro do que aconteceu.
--
-- Correção: gatilho BEFORE INSERT em trocas_plantao (vale para solicitar_troca,
-- qualquer versão dela): se um dos dois plantões já terminou, recusa. A tela do
-- plantonista deixa de listar plantões encerrados na troca (mesmo PR).
-- O plantão em curso continua podendo entrar na troca (o "já iniciado" é
-- decisão do RT, B12). Sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/escala_troca_plantao_passado.sql
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_troca_plantao_passado ON public.trocas_plantao;
--   DROP FUNCTION IF EXISTS private.troca_plantao_passado();
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.troca_plantao_passado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.escala_plantao e
              WHERE e.id IN (NEW.plantao_a_id, NEW.plantao_b_id) AND e.inicio IS NOT NULL
                AND e.inicio + make_interval(mins => e.duracao_min) <= now()) THEN
    RAISE EXCEPTION 'Um dos plantões da troca já terminou; só se trocam plantões que ainda não terminaram.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.troca_plantao_passado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_troca_plantao_passado ON public.trocas_plantao;
CREATE TRIGGER trg_troca_plantao_passado
  BEFORE INSERT ON public.trocas_plantao
  FOR EACH ROW EXECUTE FUNCTION private.troca_plantao_passado();
