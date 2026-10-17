-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5B, tarefa 4: AIH e APAC na conta (decisões do RT de 17/10/2026,
-- "1a 2a 3a 4a 5a 6a").
--
-- 1a. A conta da internação mostra todas as AIHs da internação: as rejeitadas e
--     canceladas ficam como histórico e a que vale (a mais recente solicitada ou
--     aprovada, a mesma que dá o procedimento principal) vem marcada.
-- 2a. A APAC aparece na conta a que está ligada: da internação, se tem
--     internação; senão, da porta do atendimento.
-- 3a. De cada documento: situação, número e competência (AIH) ou validade
--     (APAC); na APAC, as competências com execução e se cada uma já fechou no
--     arquivo do mês (ou ficou fora dele por crítica).
-- 4a/5a. Internação sem AIH que vale, AIH ainda não aprovada e APAC ainda não
--     autorizada só avisam; não travam o fechamento (a trava é da pré-auditoria).
-- 6a. A conta só mostra; quem solicita e decide continua na tela da regulação.
--
-- A AIH pedida na porta antes da internação (só com o episódio) conta como AIH
-- da internação aberta a partir daquele atendimento, aqui e no procedimento
-- principal da tarefa 2.
--
-- Os documentos não congelam no fechamento: são documentos próprios, com ciclo
-- próprio, e a conta mostra a situação de agora.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.conta_documentos_sus(c public.contas)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ep uuid; v_aihs jsonb; v_apacs jsonb; v_avisos jsonb := '[]'::jsonb; v_vigente uuid;
BEGIN
  IF c.tipo = 'internacao' THEN
    SELECT i.episodio_id INTO v_ep FROM public.internacoes i WHERE i.id = c.internacao_id;
    SELECT a.id INTO v_vigente FROM public.aihs a
     WHERE (a.internacao_id = c.internacao_id OR (a.internacao_id IS NULL AND v_ep IS NOT NULL AND a.episodio_id = v_ep))
       AND a.status IN ('solicitada', 'aprovada')
     ORDER BY a.solicitada_em DESC LIMIT 1;
    SELECT coalesce(jsonb_agg(x.j ORDER BY x.em DESC), '[]'::jsonb) INTO v_aihs FROM (
      SELECT a.solicitada_em AS em, jsonb_build_object(
               'id', a.id, 'status', a.status, 'numero', a.numero, 'competencia', a.competencia,
               'procedimento', p.proc, 'nome', (SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = p.proc),
               'solicitada_em', a.solicitada_em, 'decidida_em', a.decidida_em, 'motivo', a.motivo,
               'vigente', a.id = v_vigente) AS j
        FROM public.aihs a
        LEFT JOIN public.documentos_clinicos d ON d.id = a.laudo_id
        CROSS JOIN LATERAL (SELECT nullif(regexp_replace(coalesce(private.json_seguro(d.conteudo) -> 'aih' ->> 'procCod', ''), '\D', '', 'g'), '') AS proc) p
       WHERE a.internacao_id = c.internacao_id OR (a.internacao_id IS NULL AND v_ep IS NOT NULL AND a.episodio_id = v_ep)) x;
    IF v_vigente IS NULL THEN
      v_avisos := v_avisos || to_jsonb(CASE WHEN jsonb_array_length(v_aihs) > 0
        THEN 'A AIH desta internação foi rejeitada ou cancelada e não há outra solicitada.'
        ELSE 'Internação sem AIH solicitada.' END);
    ELSIF (SELECT a.status FROM public.aihs a WHERE a.id = v_vigente) = 'solicitada' THEN
      v_avisos := v_avisos || to_jsonb('AIH ainda não aprovada pelo regulador.'::text);
    END IF;
  ELSE
    v_aihs := '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(x.j ORDER BY x.em DESC), '[]'::jsonb) INTO v_apacs FROM (
    SELECT ap.solicitada_em AS em, jsonb_build_object(
             'id', ap.id, 'tipo', ap.tipo, 'status', ap.status, 'numero', ap.numero,
             'procedimento', ap.procedimento, 'nome', (SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = ap.procedimento),
             'validade_inicio', ap.validade_inicio, 'validade_fim', ap.validade_fim,
             'solicitada_em', ap.solicitada_em, 'decidida_em', ap.decidida_em, 'motivo', ap.motivo,
             'competencias', coalesce((
               SELECT jsonb_agg(jsonb_build_object(
                        'competencia', e.competencia,
                        'fechada', f.id IS NOT NULL,
                        'fora_do_arquivo', f.id IS NOT NULL AND EXISTS (
                          SELECT 1 FROM jsonb_array_elements(f.excluidas) ex WHERE ex ->> 'numero' = ap.numero))
                      ORDER BY e.competencia)
                 FROM (SELECT DISTINCT ex.competencia FROM public.apac_execucoes ex
                        WHERE ex.apac_id = ap.id AND ex.cancelado_em IS NULL) e
                 LEFT JOIN LATERAL (SELECT fe.id, fe.excluidas FROM public.apac_fechamentos fe
                                     WHERE fe.unidade_id = ap.unidade_id AND fe.competencia = e.competencia AND fe.situacao = 'fechada'
                                     ORDER BY fe.fechado_em DESC LIMIT 1) f ON true), '[]'::jsonb)) AS j
      FROM public.apacs ap
     WHERE CASE WHEN c.tipo = 'internacao' THEN ap.internacao_id = c.internacao_id
                ELSE ap.internacao_id IS NULL AND ap.episodio_id = c.episodio_id END) x;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_apacs) x WHERE x ->> 'status' = 'solicitada') THEN
    v_avisos := v_avisos || to_jsonb('APAC ainda não autorizada.'::text);
  END IF;

  RETURN jsonb_build_object('aihs', v_aihs, 'apacs', v_apacs, 'avisos', v_avisos);
END $$;
REVOKE ALL ON FUNCTION private.conta_documentos_sus(public.contas) FROM PUBLIC, anon, authenticated;

-- A AIH pedida ainda na porta, antes de a internação existir, fica com
-- internacao_id vazio e só o episódio preenchido. O procedimento principal da
-- conta da internação (tarefa 2) passa a enxergá-la também, como a lista acima.
DO $$
DECLARE def text; antigo text; novo text;
BEGIN
  def := replace(pg_get_functiondef('private.conta_itens(public.contas)'::regprocedure), E'\r', '');
  antigo := 'FROM (SELECT * FROM public.aihs a WHERE a.internacao_id = c.internacao_id AND a.status IN (''solicitada'', ''aprovada'')';
  novo := 'FROM (SELECT * FROM public.aihs a WHERE (a.internacao_id = c.internacao_id OR (a.internacao_id IS NULL AND a.episodio_id = '
       || '(SELECT i.episodio_id FROM public.internacoes i WHERE i.id = c.internacao_id))) AND a.status IN (''solicitada'', ''aprovada'')';
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'conta_itens mudou: trecho da AIH principal não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- detalhe com os documentos SUS (substitui a versão da etapa 3.3, acrescentando-os)
CREATE OR REPLACE FUNCTION public.conta_detalhe(p_conta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_itens jsonb; v_meds jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_itens := coalesce(c.itens_congelados, private.conta_itens(c));
  v_meds := coalesce(c.medicamentos_congelados, private.conta_medicamentos(c));
  RETURN private.conta_json(c) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object('evento', ev.evento, 'de', ev.de, 'para', ev.para, 'motivo', ev.motivo,
                               'por', (SELECT nome_completo FROM public.perfis WHERE id = ev.por), 'em', ev.em) ORDER BY ev.em)
                          FROM public.conta_eventos ev WHERE ev.conta_id = c.id), '[]'::jsonb),
    'pode_conduzir', private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento'),
    'pode_reabrir', private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id),
    'itens', v_itens,
    'congelada_em', c.congelada_em,
    'total_referencia', (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(v_itens) x),
    'itens_com_aviso', (SELECT count(*) FROM jsonb_array_elements(v_itens) x WHERE jsonb_array_length(coalesce(x -> 'criticas', '[]'::jsonb)) > 0),
    'medicamentos', v_meds,
    'medicamentos_com_aviso', (SELECT count(*) FROM jsonb_array_elements(v_meds) x WHERE x ->> 'aviso' IS NOT NULL AND NOT (x ->> 'fora_da_conta')::boolean),
    'documentos_sus', private.conta_documentos_sus(c));
END $$;
