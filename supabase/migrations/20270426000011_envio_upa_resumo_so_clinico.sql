-- ════════════════════════════════════════════════════════════════════════════
-- Envio da UBS à UPA: quem lê o resumo clínico (decisão do RT em 25/11/2026,
-- teste de fluxo A, item A-10).
--
-- A recepção (da UBS e da UPA) NÃO vê o resumo clínico do envio (motivo, queixa,
-- escuta, SOAP, CID, sinais): só os dados da ficha (identificação, origem,
-- hora, situação). Quem vê o resumo é a enfermagem e o médico.
--
-- Antes, as três listas (encaminhamentos_upa_destino, _origem e _do_paciente) e
-- o retorno de encaminhamento_upa_marcar_chegada devolviam o resumo inteiro a
-- qualquer papel da unidade, e o aviso "Vindo da UBS" levava o motivo a todos.
--
-- 1. private.encaminhamento_upa_json: o resumo clínico só sai para quem tem
--    papel de enfermeiro, técnico de enfermagem ou médico na unidade de origem
--    ou de destino do envio. Para os demais: identificação do paciente, origem,
--    destino, horas e situação; "motivo" vem nulo e "resumo" só com "paciente".
--    O campo novo "resumo_clinico" (boolean) diz à tela qual das duas formas veio.
-- 2. private.encaminhamento_upa_avisar: no aviso à unidade de destino, quem não
--    é da enfermagem nem médico recebe a mensagem sem o motivo clínico (o texto
--    antes do " — ").
--
-- Sem tabela nova, sem mudança de quem lista ou marca a chegada.
--
-- Rollback: recriar as duas funções como estavam em 20270216000001 (json) e
-- 20270426000005 (avisar); os corpos anteriores estão no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.encaminhamento_upa_json(x public.encaminhamentos_upa)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH quem AS (
    SELECT EXISTS (SELECT 1 FROM unnest(ARRAY[x.unidade_origem_id, x.unidade_destino_id]) u,
                                 unnest(ARRAY['enfermeiro', 'tecnico_enfermagem', 'plantonista']) r
                    WHERE private.tenho_papel(u, r) IS TRUE) AS clinico
  )
  SELECT jsonb_build_object(
    'id', x.id, 'numero', x.numero, 'situacao', x.situacao,
    'motivo', CASE WHEN q.clinico THEN x.motivo END,
    'resumo', CASE WHEN q.clinico THEN x.resumo ELSE jsonb_build_object('paciente', x.resumo -> 'paciente') END,
    'resumo_clinico', q.clinico,
    'unidade_origem_id', x.unidade_origem_id, 'unidade_origem', (SELECT nome FROM public.unidades WHERE id = x.unidade_origem_id),
    'unidade_destino_id', x.unidade_destino_id, 'unidade_destino', (SELECT nome FROM public.unidades WHERE id = x.unidade_destino_id),
    'episodio_origem_id', x.episodio_origem_id, 'paciente_id', x.paciente_id,
    'enviado_por', (SELECT nome_completo FROM public.perfis WHERE id = x.enviado_por), 'enviado_em', x.enviado_em, 'prazo_em', x.prazo_em,
    'chegada_por', (SELECT nome_completo FROM public.perfis WHERE id = x.chegada_por), 'chegada_em', x.chegada_em,
    'episodio_destino_id', x.episodio_destino_id, 'observacao_chegada', x.observacao_chegada,
    'cancelado_em', x.cancelado_em, 'motivo_cancelamento', x.motivo_cancelamento)
  FROM quem q
$$;
REVOKE ALL ON FUNCTION private.encaminhamento_upa_json(public.encaminhamentos_upa) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.encaminhamento_upa_avisar(x public.encaminhamentos_upa, p_destino boolean, p_tipo text, p_mensagem text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  -- sem o motivo clínico: o texto antes do " — " ("Vindo da UBS X: Fulano")
  v_curta text := CASE WHEN position(' — ' IN p_mensagem) > 0 THEN split_part(p_mensagem, ' — ', 1) || '.' ELSE p_mensagem END;
BEGIN
  IF p_destino THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    SELECT vi.perfil_id, x.unidade_destino_id, private.data_atual(), p_tipo || '_' || x.numero,
           CASE WHEN bool_or(vi.papel::text IN ('enfermeiro', 'plantonista')) THEN p_mensagem ELSE v_curta END
      FROM public.vinculos vi
     WHERE vi.unidade_id = x.unidade_destino_id AND vi.ativo AND vi.papel::text IN ('recepcao', 'enfermeiro', 'plantonista', 'gestor')
     GROUP BY vi.perfil_id
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  ELSE
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (x.enviado_por, x.unidade_origem_id, private.data_atual(), p_tipo || '_' || x.numero, p_mensagem)
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.encaminhamento_upa_avisar(public.encaminhamentos_upa, boolean, text, text) FROM PUBLIC, anon, authenticated;

-- ── Rollback: corpos anteriores ─────────────────────────────────────────────
-- encaminhamento_upa_json (20270216000001): o mesmo jsonb_build_object, com
--   'motivo', x.motivo, 'resumo', x.resumo  e sem 'resumo_clinico' nem a CTE.
-- encaminhamento_upa_avisar (20270426000005): no ramo p_destino,
--   SELECT DISTINCT vi.perfil_id, x.unidade_destino_id, private.data_atual(), p_tipo || '_' || x.numero, p_mensagem
--   FROM public.vinculos vi WHERE ... (sem GROUP BY e sem v_curta).
