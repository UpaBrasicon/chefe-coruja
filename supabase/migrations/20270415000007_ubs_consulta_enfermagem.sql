-- Percurso da UBS, U6, PR 3 (plano docs/ubs/U6-U7-PLANO.md; RT, 17/11/2026):
-- consulta de enfermagem na UBS.
--
-- 1. private.medico_na_porta passa a aceitar também o enfermeiro de plantão no
--    consultório quando a ficha é da enfermagem (episodios.destino_aps =
--    'enfermagem', PR 2). Vale para iniciar o atendimento, salvar o rascunho,
--    registrar o SOAP, fechar pela conduta da UBS (registrar_conduta_aps) e
--    registrar a evasão. Ficha sem destino ou do médico segue só do médico, e a
--    porta da UPA não muda.
--    A consulta fechada pelo enfermeiro já conta no hiperdia, no pré-natal e na
--    puericultura: os gatilhos leem a conduta da UBS, sem olhar quem fechou
--    (como nas notas da SAPS, em que o CBO 2235 conta igual ao médico).
-- 2. Pedido de exame na consulta de enfermagem: fica recusado até o PR da lista
--    do protocolo (P1 = A). Prescrição pelo enfermeiro: PR 3b (P2 = B). O envio
--    à UPA segue só do médico (D2).
--
-- Idempotente. Teste: supabase/tests/ubs_consulta_enfermagem.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER trg_exame_consulta_enfermagem ON public.exames_pedidos;
--   DROP FUNCTION private.exame_consulta_enfermagem();
--   recriar private.medico_na_porta(public.episodios) de
--     20260927000004_fase2_atendimento_desfecho.sql.

-- ── 1. quem atende ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.medico_na_porta(e public.episodios) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE THEN RETURN; END IF;
  -- U6, PR 3: a ficha da UBS para a enfermagem é atendida pelo enfermeiro
  IF e.destino_aps = 'enfermagem' AND private.tenho_papel(e.unidade_id, 'enfermeiro') IS TRUE THEN RETURN; END IF;
  RAISE EXCEPTION 'O atendimento é do médico.';
END $$;
REVOKE ALL ON FUNCTION private.medico_na_porta(public.episodios) FROM PUBLIC, anon, authenticated;

-- ── 2. exame: ainda só o médico ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.exame_consulta_enfermagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios;
BEGIN
  IF NEW.episodio_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO e FROM public.episodios WHERE id = NEW.episodio_id;
  IF e.destino_aps = 'enfermagem' AND private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O pedido de exame na consulta de enfermagem chega com a lista do protocolo da atenção básica.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.exame_consulta_enfermagem() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_exame_consulta_enfermagem ON public.exames_pedidos;
CREATE TRIGGER trg_exame_consulta_enfermagem BEFORE INSERT ON public.exames_pedidos
  FOR EACH ROW EXECUTE FUNCTION private.exame_consulta_enfermagem();
