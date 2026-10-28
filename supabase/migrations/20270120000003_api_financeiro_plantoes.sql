-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 3 (ERP/financeiro), etapa 3.3: os plantões na porta do ERP.
--
-- A porta public.api_v1_financeiro (etapa 3.1) ganha duas ações, com as mesmas
-- regras das contas (decisões do RT de 27/10/2026, "1a 4a 5a" e plantões
-- "1a 2a 3a"):
--   plantoes:         p_dados {unidade_id?, desde?, competencia?, situacao?, conciliacao?, limite?, cursor?}
--   plantoes_retorno: p_dados {versao_id, acao: lancada | estornada, erp_id, recebida_em?, valor_lancado}
-- "lancada" marca conciliada (valor igual ao total) ou divergente; "estornada"
-- só vale para a versão substituída (o gestor reabriu o mês); reenvio igual
-- não muda nada. Cada mudança vai para a auditoria. O motivo da reabertura
-- (texto livre do gestor) não vai ao ERP.
--
-- expand: função nova e trechos novos na porta; as ações das contas não mudam.
--
-- Rollback (testado na homologação): reaplicar public.api_v1_financeiro da
-- 20270120000001_erp_contas.sql e
--   DROP FUNCTION IF EXISTS private.erp_plantao_versao_json(public.plantao_versoes_erp);
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.erp_plantao_versao_json(v public.plantao_versoes_erp)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.dados || jsonb_build_object(
    'id', v.id, 'versao', v.versao, 'situacao', v.situacao, 'total', v.total,
    'gerada_em', v.gerada_em, 'substituida_em', v.substituida_em, 'alterada_em', v.alterada_em,
    'conciliacao', v.conciliacao,
    'retorno', CASE WHEN v.retorno_em IS NOT NULL THEN jsonb_build_object(
                 'erp_id', v.erp_id, 'recebida_em', v.erp_recebida_em, 'valor_lancado', v.valor_lancado, 'em', v.retorno_em) END)
$$;
REVOKE ALL ON FUNCTION private.erp_plantao_versao_json(public.plantao_versoes_erp) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE def text; novo text;
  ja text := 'ELSIF p_acao = ''plantoes_retorno'' THEN';
  decl_antigo text := 'v_acao text; v_erp text; v_valor numeric; v_quando timestamptz; v_conc text;';
  fim_antigo text := '    ELSE
      v_status := 404; v_corpo := jsonb_build_object(''codigo'', ''nao_encontrado'', ''detalhe'', ''Ação inexistente.'');';
BEGIN
  -- sem CR dos dois lados: o arquivo pode estar em CRLF na máquina de quem aplica
  fim_antigo := replace(fim_antigo, E'\r', '');
  def := replace(pg_get_functiondef('public.api_v1_financeiro(text, text, text, text, jsonb)'::regprocedure), E'\r', '');
  IF position(ja IN def) > 0 THEN RETURN; END IF;  -- já aplicada
  IF position(decl_antigo IN def) = 0 OR position(fim_antigo IN def) = 0 THEN
    RAISE EXCEPTION 'api_v1_financeiro mudou: trechos da 20270120000001 não encontrados';
  END IF;
  novo := $novo$    ELSIF p_acao = 'plantoes' THEN
      v_unidade := nullif(d ->> 'unidade_id', '')::uuid;
      v_desde := nullif(d ->> 'desde', '')::timestamptz;
      v_desloc := private.api_cursor(d ->> 'cursor');
      IF v_unidade IS NOT NULL AND NOT v_unidade = ANY (c.unidades) THEN
        v_status := 403; v_corpo := jsonb_build_object('codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera esta unidade.');
      ELSE
        WITH f AS (
          SELECT x.* FROM public.plantao_versoes_erp x
           WHERE x.unidade_id = ANY (CASE WHEN v_unidade IS NULL THEN c.unidades ELSE ARRAY[v_unidade] END)
             AND (v_desde IS NULL OR x.alterada_em >= v_desde)
             AND (NOT d ? 'competencia' OR x.competencia = d ->> 'competencia')
             AND (NOT d ? 'situacao' OR x.situacao = d ->> 'situacao')
             AND (NOT d ? 'conciliacao' OR x.conciliacao = d ->> 'conciliacao')
           ORDER BY x.alterada_em, x.id OFFSET v_desloc LIMIT v_lim + 1)
        SELECT jsonb_build_object('dados', coalesce((SELECT jsonb_agg(private.erp_plantao_versao_json(f) ORDER BY f.alterada_em, f.id)
                                                       FROM (SELECT * FROM f ORDER BY alterada_em, id LIMIT v_lim) f), '[]'::jsonb),
                                  'proximo_cursor', private.api_proximo(v_desloc, v_lim, (SELECT count(*)::int FROM f)))
          INTO v_corpo;
      END IF;

    ELSIF p_acao = 'plantoes_retorno' THEN
      SELECT * INTO vp FROM public.plantao_versoes_erp WHERE id = nullif(d ->> 'versao_id', '')::uuid FOR UPDATE;
      v_unidade := vp.unidade_id;
      v_acao := d ->> 'acao';
      v_erp := nullif(btrim(coalesce(d ->> 'erp_id', '')), '');
      v_quando := coalesce(nullif(d ->> 'recebida_em', '')::timestamptz, now());
      v_valor := round(nullif(d ->> 'valor_lancado', '')::numeric, 2);
      IF vp.id IS NULL OR NOT vp.unidade_id = ANY (c.unidades) THEN
        v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Versão dos plantões não encontrada.');
      ELSIF v_acao IS NULL OR v_acao NOT IN ('lancada', 'estornada') THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'acao: lancada ou estornada.');
      ELSIF v_quando > now() + interval '5 minutes' THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'recebida_em está no futuro.');
      ELSIF v_erp IS NOT NULL AND length(v_erp) > 100 THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'erp_id de 1 a 100 letras.');
      ELSIF v_acao = 'lancada' AND v_erp IS NULL THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Informe erp_id (o identificador do lançamento no ERP).');
      ELSIF v_acao = 'lancada' AND (v_valor IS NULL OR v_valor < 0) THEN
        v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Informe valor_lancado (zero ou mais).');
      ELSIF v_acao = 'lancada' AND vp.situacao = 'substituida' THEN
        v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito',
          'detalhe', 'Esta versão foi substituída (o gestor reabriu o mês): estorne no ERP e mande acao "estornada".');
      ELSIF v_acao = 'estornada' AND vp.situacao = 'vigente' THEN
        v_status := 409; v_corpo := jsonb_build_object('codigo', 'conflito',
          'detalhe', 'A versão vigente não se estorna: ela só é substituída quando o gestor reabre o mês.');
      ELSE
        v_conc := CASE WHEN v_acao = 'estornada' THEN 'estornada' WHEN v_valor = vp.total THEN 'conciliada' ELSE 'divergente' END;
        -- reenvio igual não muda nada nem repete a auditoria
        IF NOT (vp.conciliacao = v_conc AND (v_conc = 'estornada' OR (vp.erp_id = v_erp AND vp.valor_lancado = v_valor))) THEN
          UPDATE public.plantao_versoes_erp
             SET conciliacao = v_conc, erp_id = coalesce(v_erp, erp_id), erp_recebida_em = v_quando,
                 valor_lancado = CASE WHEN v_conc = 'estornada' THEN valor_lancado ELSE v_valor END,
                 retorno_em = now(), retorno_chave = c.id
           WHERE id = vp.id RETURNING * INTO vp;
          PERFORM private.registrar_auditoria('plantoes_erp_' || v_conc, 'plantao_versoes_erp', vp.id, vp.unidade_id,
            jsonb_build_object('competencia', vp.competencia, 'versao', vp.versao, 'total', vp.total,
                               'valor_lancado', vp.valor_lancado, 'chave', c.prefixo));
        END IF;
        v_corpo := jsonb_build_object('versao_id', vp.id, 'competencia', vp.competencia, 'versao', vp.versao,
                                      'conciliacao', vp.conciliacao, 'total', vp.total, 'valor_lancado', vp.valor_lancado, 'erp_id', vp.erp_id);
      END IF;

$novo$;
  novo := replace(novo, E'\r', '');
  def := replace(def, decl_antigo, decl_antigo || ' vp public.plantao_versoes_erp;');
  EXECUTE replace(def, fim_antigo, novo || fim_antigo);
END $$;
