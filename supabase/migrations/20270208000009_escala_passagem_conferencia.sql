-- ════════════════════════════════════════════════════════════════════════════
-- Bug médio M3 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- o pedido de passagem aceitava destino com plantão sobreposto em outro setor
-- (private.tem_conflito_plantao só compara o mesmo setor, data e faixa), pedido
-- repetido do mesmo plantão e plantão que já terminou. A sobreposição real só
-- aparecia na hora de aplicar.
--
-- Correção: gatilho BEFORE INSERT em solicitacoes_escala (tipo passar_plantao),
-- que vale para passar_plantao e para a inserção direta, e confere:
--  * o plantão ainda não terminou;
--  * não há outro pedido de passagem pendente do mesmo plantão;
--  * o destino não está escalado em horário que se sobrepõe, em qualquer setor
--    (private.conflito_escala, a mesma regra da trava de sobreposição).
-- O plantão em curso continua podendo ser passado (quem sai no meio do plantão).
-- Sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/escala_passagem_conferencia.sql
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_passagem_conferir ON public.solicitacoes_escala;
--   DROP FUNCTION IF EXISTS private.passagem_conferir();
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.passagem_conferir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
  v_conflito text;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = NEW.escala_plantao_id;
  IF v_pl.id IS NULL THEN RETURN NEW; END IF;
  IF v_pl.inicio IS NOT NULL AND v_pl.inicio + make_interval(mins => v_pl.duracao_min) <= now() THEN
    RAISE EXCEPTION 'O plantão já terminou; não dá para passá-lo.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.solicitacoes_escala s
              WHERE s.escala_plantao_id = NEW.escala_plantao_id AND s.tipo = 'passar_plantao' AND s.status = 'pendente') THEN
    RAISE EXCEPTION 'Já existe um pedido de passagem pendente para este plantão. Cancele ou espere a resposta.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.destino_perfil_id IS NOT NULL AND v_pl.inicio IS NOT NULL THEN
    v_conflito := private.conflito_escala(NEW.destino_perfil_id, v_pl.inicio, v_pl.duracao_min, v_pl.id);
    IF v_conflito IS NOT NULL THEN
      RAISE EXCEPTION 'Conflito de horário: % já está escalado(a) %.',
        coalesce((SELECT nome_completo FROM public.perfis WHERE id = NEW.destino_perfil_id), 'o destino'), v_conflito
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.passagem_conferir() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_passagem_conferir ON public.solicitacoes_escala;
CREATE TRIGGER trg_passagem_conferir
  BEFORE INSERT ON public.solicitacoes_escala
  FOR EACH ROW
  WHEN (NEW.tipo = 'passar_plantao')
  EXECUTE FUNCTION private.passagem_conferir();
