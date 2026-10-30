-- ════════════════════════════════════════════════════════════════════════════
-- Bugs médios M5 e M6 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- M5: nenhum aviso das decisões do gestor (candidatura aprovada ou recusada,
--     falta e saída do fixo decididas), embora as telas prometam ("você recebe
--     o aviso"). Só a vaga aberta avisava.
-- M6: auditoria incompleta: essas decisões não iam para historico_escala nem
--     para log_auditoria (eram feitas por update direto, fora de RPC).
--
-- Correção: gatilhos AFTER UPDATE OF status em candidaturas_escala e em
-- solicitacoes_escala (tipos falta e saída do fixo; a passagem tem os seus, da
-- C2 e do A4). Valem pela RPC (aprovar_candidatura) e pelo update direto da tela
-- do gestor. Cada decisão: aviso no sino de quem pediu, linha em historico_escala
-- e linha em log_auditoria (private.registrar_auditoria, payload só estrutural).
-- Nada muda no que a decisão faz (M2 espera a decisão do RT).
--
-- private.avisar é a mesma da 20270208000006 (A4): CREATE OR REPLACE igual nas
-- duas, para cada uma valer sozinha. Sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/escala_avisos_decisoes.sql
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_candidatura_decidida ON public.candidaturas_escala;
--   DROP TRIGGER IF EXISTS trg_solicitacao_decidida ON public.solicitacoes_escala;
--   DROP FUNCTION IF EXISTS private.candidatura_decidida(), private.solicitacao_decidida();
--   (private.avisar fica se a 20270208000006 estiver aplicada; senão
--    DROP FUNCTION IF EXISTS private.avisar(uuid, uuid, date, text, text).)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.avisar(p_perfil uuid, p_unidade uuid, p_data date, p_tipo text, p_msg text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $function$
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT p_perfil, p_unidade, coalesce(p_data, private.data_atual()), p_tipo, p_msg
   WHERE p_perfil IS NOT NULL
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING
$function$;
REVOKE ALL ON FUNCTION private.avisar(uuid, uuid, date, text, text) FROM PUBLIC, anon, authenticated;

-- ── candidatura ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.candidatura_decidida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_desc text;
  v_aprovada boolean := NEW.status = 'aprovado';
BEGIN
  v_desc := coalesce((SELECT nome FROM public.setores WHERE id = NEW.setor_id), 'setor') || ' em '
            || to_char(NEW.data, 'DD/MM') || ' ('
            || CASE NEW.turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END || ')';
  PERFORM private.avisar(NEW.perfil_id, NEW.unidade_id, NEW.data, 'candidatura_decidida_' || NEW.id,
    CASE WHEN v_aprovada
         THEN 'Candidatura aprovada: o plantão de ' || v_desc || ' é seu. Confira na escala.'
         ELSE 'Candidatura recusada: o plantão de ' || v_desc || ' ficou com outra pessoa ou foi retirado.' END);
  PERFORM private.registrar_historico(NEW.unidade_id, NULL,
    CASE WHEN v_aprovada THEN 'candidatura_aprovada' ELSE 'candidatura_recusada' END,
    v_desc, jsonb_build_object('candidatura_id', NEW.id, 'perfil_id', NEW.perfil_id, 'decidido_por', NEW.decidido_por));
  PERFORM private.registrar_auditoria(
    CASE WHEN v_aprovada THEN 'candidatura_aprovada' ELSE 'candidatura_recusada' END,
    'candidaturas_escala', NEW.id, NEW.unidade_id,
    jsonb_build_object('perfil_id', NEW.perfil_id, 'setor_id', NEW.setor_id, 'status', NEW.status));
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.candidatura_decidida() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_candidatura_decidida ON public.candidaturas_escala;
CREATE TRIGGER trg_candidatura_decidida
  AFTER UPDATE OF status ON public.candidaturas_escala
  FOR EACH ROW
  WHEN (OLD.status = 'pendente' AND NEW.status IN ('aprovado', 'recusado'))
  EXECUTE FUNCTION private.candidatura_decidida();

-- ── falta e saída do fixo ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.solicitacao_decidida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_pl public.escala_plantao%ROWTYPE;
  v_desc text;
  v_aprovado boolean := NEW.status = 'aprovado';
  v_oque text;
BEGIN
  SELECT * INTO v_pl FROM public.escala_plantao WHERE id = NEW.escala_plantao_id;
  v_desc := coalesce((SELECT nome FROM public.setores WHERE id = v_pl.setor_id), 'setor') || ' em '
            || coalesce(to_char(v_pl.data, 'DD/MM'), '?') || ' ('
            || CASE v_pl.turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END || ')';
  v_oque := CASE NEW.tipo WHEN 'justificar_falta' THEN 'A justificativa de falta' ELSE 'O pedido de saída do fixo' END;
  PERFORM private.avisar(NEW.perfil_id, NEW.unidade_id, v_pl.data, 'pedido_decidido_' || NEW.id,
    v_oque || ' do plantão de ' || v_desc || ' foi ' || CASE WHEN v_aprovado THEN 'aprovad' ELSE 'recusad' END
      || CASE NEW.tipo WHEN 'justificar_falta' THEN 'a' ELSE 'o' END || ' pela coordenação.');
  PERFORM private.registrar_historico(NEW.unidade_id, NEW.escala_plantao_id,
    CASE NEW.tipo WHEN 'justificar_falta' THEN 'falta_' || CASE WHEN v_aprovado THEN 'aprovada' ELSE 'recusada' END
                  ELSE 'sair_fixo_' || NEW.status END,
    v_desc, jsonb_build_object('solicitacao', NEW.id, 'perfil_id', NEW.perfil_id, 'decidido_por', NEW.decidido_por));
  PERFORM private.registrar_auditoria(NEW.tipo || '_' || NEW.status, 'solicitacoes_escala', NEW.id, NEW.unidade_id,
    jsonb_build_object('perfil_id', NEW.perfil_id, 'tipo', NEW.tipo, 'status', NEW.status));
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.solicitacao_decidida() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_solicitacao_decidida ON public.solicitacoes_escala;
CREATE TRIGGER trg_solicitacao_decidida
  AFTER UPDATE OF status ON public.solicitacoes_escala
  FOR EACH ROW
  WHEN (NEW.tipo IN ('justificar_falta', 'sair_fixo') AND OLD.status = 'pendente' AND NEW.status IN ('aprovado', 'recusado'))
  EXECUTE FUNCTION private.solicitacao_decidida();
