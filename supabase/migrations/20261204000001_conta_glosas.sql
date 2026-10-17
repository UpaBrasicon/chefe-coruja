-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5B, tarefa 6: glosas (decisões do RT de 17/10/2026, "1a 2a 3a 4a 5a 6a").
--
-- 1a. O faturamento registra a glosa à mão, a partir do relatório de rejeição
--     do SIA/SIH ou do gestor municipal. Importar o arquivo de retorno fica
--     para depois.
-- 2a. A glosa é de um item da conta (linha do BPA, AIH, lançamento ou APAC
--     ligada) ou da conta inteira.
-- 3a. O valor vem do valor de referência do SIGTAP do item e pode ser mudado.
-- 4a. Motivo de uma lista padrão, com texto livre ("outro" exige o texto).
-- 5a. aberta → em recurso (reapresentada ou recorrida, com a competência nova)
--     → recuperada ou perdida; o recurso negado volta a aberta. Histórico e
--     motivo em cada passo.
-- 6a. O faturamento registra e conduz; só o gestor marca como perdida. A glosa
--     só entra em conta fechada ou faturada, e a conta não muda de etapa.
--     Painel com o total por competência e por motivo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.conta_glosas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id           uuid NOT NULL REFERENCES public.contas(id),
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id),
  -- item glosado; os dois nulos = conta inteira
  item_origem        text,
  item_id            uuid,
  item_rotulo        text NOT NULL,
  competencia        text NOT NULL CHECK (competencia ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  valor              numeric(12, 2) NOT NULL CHECK (valor >= 0),
  valor_sugerido     numeric(12, 2),
  motivo_codigo      text NOT NULL CHECK (motivo_codigo IN ('cns', 'cbo', 'cid', 'quantidade', 'duplicidade', 'prazo', 'documento', 'outro')),
  motivo_texto       text,
  status             text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_recurso', 'recuperada', 'perdida')),
  competencia_recurso text CHECK (competencia_recurso ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  valor_recuperado   numeric(12, 2) CHECK (valor_recuperado >= 0),
  registrada_por     uuid NOT NULL REFERENCES public.perfis(id),
  registrada_em      timestamptz NOT NULL DEFAULT now(),
  status_por         uuid REFERENCES public.perfis(id),
  status_em          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conta_glosas_item CHECK ((item_origem IS NULL) = (item_id IS NULL)),
  CONSTRAINT conta_glosas_recuperada CHECK ((status = 'recuperada') = (valor_recuperado IS NOT NULL))
);
CREATE INDEX conta_glosas_conta ON public.conta_glosas (conta_id);
CREATE INDEX conta_glosas_unidade ON public.conta_glosas (unidade_id, competencia);
-- uma glosa em andamento por item (ou pela conta inteira)
CREATE UNIQUE INDEX conta_glosas_ativa ON public.conta_glosas (conta_id, coalesce(item_id, conta_id))
  WHERE status IN ('aberta', 'em_recurso');

CREATE TABLE public.conta_glosa_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glosa_id    uuid NOT NULL REFERENCES public.conta_glosas(id),
  evento      text NOT NULL,
  de          text,
  para        text,
  motivo      text,
  competencia text,
  valor       numeric(12, 2),
  por         uuid NOT NULL REFERENCES public.perfis(id),
  em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conta_glosa_eventos_glosa ON public.conta_glosa_eventos (glosa_id);

ALTER TABLE public.conta_glosas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_glosa_eventos ENABLE ROW LEVEL SECURITY;
-- só pelas funções: sem política e sem privilégio direto
REVOKE ALL ON public.conta_glosas FROM anon, authenticated;
REVOKE ALL ON public.conta_glosa_eventos FROM anon, authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.conta_glosas FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.conta_glosa_eventos FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

CREATE OR REPLACE FUNCTION private.glosa_json(g public.conta_glosas)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', g.id, 'conta_id', g.conta_id, 'conta_numero', (SELECT k.numero FROM public.contas k WHERE k.id = g.conta_id),
    'paciente', (SELECT p.nome FROM public.contas k JOIN public.pacientes p ON p.id = k.paciente_id WHERE k.id = g.conta_id),
    'item_origem', g.item_origem, 'item_id', g.item_id, 'item_rotulo', g.item_rotulo,
    'competencia', g.competencia, 'valor', g.valor, 'valor_sugerido', g.valor_sugerido,
    'motivo_codigo', g.motivo_codigo, 'motivo_texto', g.motivo_texto, 'status', g.status,
    'competencia_recurso', g.competencia_recurso, 'valor_recuperado', g.valor_recuperado,
    'registrada_por', (SELECT nome_completo FROM public.perfis WHERE id = g.registrada_por), 'registrada_em', g.registrada_em,
    'status_em', g.status_em,
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object('evento', e.evento, 'de', e.de, 'para', e.para, 'motivo', e.motivo,
                                   'competencia', e.competencia, 'valor', e.valor,
                                   'por', (SELECT nome_completo FROM public.perfis WHERE id = e.por), 'em', e.em) ORDER BY e.em)
                           FROM public.conta_glosa_eventos e WHERE e.glosa_id = g.id), '[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION private.glosa_json(public.conta_glosas) FROM PUBLIC, anon, authenticated;

-- 2a/3a. o que pode ser glosado na conta, com o valor de referência e a
-- competência da produção: os itens guardados da conta e as APACs ligadas
CREATE OR REPLACE FUNCTION private.glosaveis_da_conta(c public.contas)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_array(jsonb_build_object(
           'origem', NULL, 'id', NULL, 'rotulo', 'Conta inteira',
           'valor', (SELECT coalesce(sum((x ->> 'valor_total')::numeric), 0) FROM jsonb_array_elements(coalesce(c.itens_congelados, '[]'::jsonb)) x),
           'competencia', to_char(coalesce(c.congelada_em, c.status_em) AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')))
    || coalesce((SELECT jsonb_agg(jsonb_build_object(
           'origem', x ->> 'origem', 'id', x ->> 'origem_id',
           'rotulo', CASE x ->> 'origem' WHEN 'atendimento' THEN 'Atendimento médico' WHEN 'classificacao' THEN 'Classificação de risco'
                       WHEN 'medicacao' THEN 'Medicação administrada' WHEN 'registro' THEN 'Procedimento lançado'
                       WHEN 'aih' THEN 'AIH (principal)' WHEN 'lancamento' THEN 'Lançado (especial)' ELSE x ->> 'origem' END
                     || ' · ' || coalesce(x ->> 'procedimento', 'sem código') || coalesce(' · ' || (x ->> 'nome'), ''),
           'valor', coalesce((x ->> 'valor_total')::numeric, 0),
           'competencia', coalesce(nullif(x -> 'aih' ->> 'competencia', ''),
                                   to_char((x ->> 'em')::timestamptz AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'),
                                   to_char(c.aberta_em AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))))
          FROM jsonb_array_elements(coalesce(c.itens_congelados, '[]'::jsonb)) x), '[]'::jsonb)
    || coalesce((SELECT jsonb_agg(jsonb_build_object(
           'origem', 'apac', 'id', ap.id,
           'rotulo', 'APAC ' || coalesce(ap.numero, 'sem número') || ' · ' || ap.procedimento
                     || coalesce(' · ' || (SELECT sp.nome FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = ap.procedimento), ''),
           'valor', coalesce((SELECT sp.valor_sa FROM terminologia.sigtap_procedimento sp WHERE sp.codigo = ap.procedimento), 0),
           'competencia', coalesce((SELECT max(e.competencia) FROM public.apac_execucoes e WHERE e.apac_id = ap.id AND e.cancelado_em IS NULL),
                                   to_char(ap.solicitada_em AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'))))
          FROM public.apacs ap
         WHERE CASE WHEN c.tipo = 'internacao' THEN ap.internacao_id = c.internacao_id
                    ELSE ap.internacao_id IS NULL AND ap.episodio_id = c.episodio_id END), '[]'::jsonb)
$$;
REVOKE ALL ON FUNCTION private.glosaveis_da_conta(public.contas) FROM PUBLIC, anon, authenticated;

-- 1a/2a/3a/4a. registrar
CREATE OR REPLACE FUNCTION public.registrar_glosa(p_conta uuid, p_origem text, p_item uuid, p_motivo_codigo text,
                                                 p_motivo_texto text DEFAULT NULL, p_valor numeric DEFAULT NULL, p_competencia text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; g public.conta_glosas; v_eu uuid := private.meu_perfil_id(); v_alvo jsonb;
        v_texto text := nullif(btrim(coalesce(p_motivo_texto, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento')) THEN
    RAISE EXCEPTION 'Acesso negado: quem registra glosa é o faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status NOT IN ('fechada', 'faturada') THEN RAISE EXCEPTION 'Glosa só entra em conta fechada ou faturada.'; END IF;
  IF p_motivo_codigo IS NULL OR p_motivo_codigo NOT IN ('cns', 'cbo', 'cid', 'quantidade', 'duplicidade', 'prazo', 'documento', 'outro') THEN
    RAISE EXCEPTION 'Escolha o motivo da glosa.';
  END IF;
  IF p_motivo_codigo = 'outro' AND length(coalesce(v_texto, '')) < 10 THEN
    RAISE EXCEPTION 'Motivo "outro": descreva a glosa (mínimo de 10 letras).';
  END IF;
  SELECT x INTO v_alvo FROM jsonb_array_elements(private.glosaveis_da_conta(c)) x
   WHERE x ->> 'origem' IS NOT DISTINCT FROM p_origem AND (x ->> 'id')::uuid IS NOT DISTINCT FROM p_item
   LIMIT 1;
  IF v_alvo IS NULL THEN RAISE EXCEPTION 'Item não encontrado nesta conta.'; END IF;
  IF p_valor IS NOT NULL AND p_valor < 0 THEN RAISE EXCEPTION 'Valor da glosa não pode ser negativo.'; END IF;
  IF p_competencia IS NOT NULL AND p_competencia !~ '^[0-9]{4}(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
  IF EXISTS (SELECT 1 FROM public.conta_glosas k WHERE k.conta_id = c.id AND coalesce(k.item_id, k.conta_id) = coalesce(p_item, c.id)
                AND k.status IN ('aberta', 'em_recurso')) THEN
    RAISE EXCEPTION 'Já há glosa em andamento para este item.';
  END IF;
  INSERT INTO public.conta_glosas (conta_id, unidade_id, item_origem, item_id, item_rotulo, competencia, valor, valor_sugerido,
                                   motivo_codigo, motivo_texto, registrada_por, status_por)
  VALUES (c.id, c.unidade_id, p_origem, p_item, v_alvo ->> 'rotulo', coalesce(p_competencia, v_alvo ->> 'competencia'),
          round(coalesce(p_valor, (v_alvo ->> 'valor')::numeric), 2), (v_alvo ->> 'valor')::numeric, p_motivo_codigo, v_texto, v_eu, v_eu)
  RETURNING * INTO g;
  INSERT INTO public.conta_glosa_eventos (glosa_id, evento, para, motivo, competencia, valor, por)
  VALUES (g.id, 'registrada', 'aberta', v_texto, g.competencia, g.valor, v_eu);
  PERFORM private.registrar_auditoria('glosa_registrada', 'conta_glosas', g.id, c.unidade_id,
    jsonb_build_object('conta', c.numero, 'item', g.item_rotulo, 'motivo', g.motivo_codigo, 'valor', g.valor));
  RETURN private.glosa_json(g);
END $$;
REVOKE ALL ON FUNCTION public.registrar_glosa(uuid, text, uuid, text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_glosa(uuid, text, uuid, text, text, numeric, text) TO authenticated;

-- 5a/6a. acompanhar
CREATE OR REPLACE FUNCTION public.mudar_glosa(p_glosa uuid, p_para text, p_motivo text,
                                             p_competencia text DEFAULT NULL, p_valor_recuperado numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.conta_glosas; v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
        v_fat boolean; v_gestor boolean; v_evento text; v_de text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO g FROM public.conta_glosas WHERE id = p_glosa FOR UPDATE;
  IF g.id IS NULL OR NOT private.pode_ver_contas(g.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: glosas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_de := g.status;
  v_fat := private.eh_super_admin() OR private.tenho_papel(g.unidade_id, 'faturamento');
  v_gestor := private.eh_super_admin() OR private.gestor_da_unidade(g.unidade_id);
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Escreva o motivo deste passo (mínimo de 10 letras).'; END IF;

  IF g.status = 'aberta' AND p_para = 'em_recurso' THEN
    IF NOT v_fat THEN RAISE EXCEPTION 'O recurso é do faturamento.'; END IF;
    IF p_competencia IS NULL OR p_competencia !~ '^[0-9]{4}(0[1-9]|1[0-2])$' THEN
      RAISE EXCEPTION 'Diga a competência em que a produção foi reapresentada ou o recurso enviado (AAAAMM).';
    END IF;
    IF p_competencia < g.competencia THEN RAISE EXCEPTION 'A competência do recurso não pode ser anterior à da produção glosada.'; END IF;
    v_evento := 'recurso';
  ELSIF g.status = 'em_recurso' AND p_para = 'aberta' THEN
    IF NOT v_fat THEN RAISE EXCEPTION 'O recurso é do faturamento.'; END IF;
    v_evento := 'recurso_negado';
  ELSIF g.status = 'em_recurso' AND p_para = 'recuperada' THEN
    IF NOT v_fat THEN RAISE EXCEPTION 'O recurso é do faturamento.'; END IF;
    IF p_valor_recuperado IS NOT NULL AND (p_valor_recuperado < 0 OR p_valor_recuperado > g.valor) THEN
      RAISE EXCEPTION 'Valor recuperado entre zero e o valor glosado.';
    END IF;
    v_evento := 'recuperada';
  ELSIF g.status IN ('aberta', 'em_recurso') AND p_para = 'perdida' THEN
    IF NOT v_gestor THEN RAISE EXCEPTION 'Só o gestor marca a glosa como perdida.'; END IF;
    v_evento := 'perdida';
  ELSE
    RAISE EXCEPTION 'Mudança não permitida: de % para %.', g.status, p_para;
  END IF;

  UPDATE public.conta_glosas SET status = p_para, status_em = now(), status_por = v_eu,
         competencia_recurso = CASE WHEN p_para = 'em_recurso' THEN p_competencia ELSE competencia_recurso END,
         valor_recuperado = CASE WHEN p_para = 'recuperada' THEN round(coalesce(p_valor_recuperado, valor), 2) ELSE NULL END
   WHERE id = g.id RETURNING * INTO g;
  INSERT INTO public.conta_glosa_eventos (glosa_id, evento, de, para, motivo, competencia, valor, por)
  VALUES (g.id, v_evento, v_de, p_para, v_motivo,
          CASE WHEN p_para = 'em_recurso' THEN p_competencia END, CASE WHEN p_para = 'recuperada' THEN g.valor_recuperado END, v_eu);
  PERFORM private.registrar_auditoria('glosa_' || v_evento, 'conta_glosas', g.id, g.unidade_id,
    jsonb_build_object('item', g.item_rotulo, 'para', p_para, 'motivo', v_motivo, 'competencia', p_competencia, 'valor_recuperado', g.valor_recuperado));
  RETURN private.glosa_json(g);
END $$;
REVOKE ALL ON FUNCTION public.mudar_glosa(uuid, text, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mudar_glosa(uuid, text, text, text, numeric) TO authenticated;

-- 6a. lista e painel da unidade
CREATE OR REPLACE FUNCTION public.glosas_da_unidade(p_unidade uuid, p_status text DEFAULT NULL, p_competencia text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: glosas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'glosas', coalesce((SELECT jsonb_agg(private.glosa_json(g) ORDER BY g.registrada_em DESC) FROM (
                SELECT * FROM public.conta_glosas g
                 WHERE g.unidade_id = p_unidade AND (p_status IS NULL OR g.status = p_status)
                   AND (p_competencia IS NULL OR g.competencia = p_competencia)
                 ORDER BY g.registrada_em DESC LIMIT 500) g), '[]'::jsonb),
    'por_competencia', coalesce((SELECT jsonb_agg(x ORDER BY x ->> 'competencia' DESC) FROM (
                SELECT jsonb_build_object('competencia', g.competencia, 'quantidade', count(*),
                         'glosado', sum(g.valor), 'recuperado', coalesce(sum(g.valor_recuperado), 0),
                         'perdido', coalesce(sum(g.valor) FILTER (WHERE g.status = 'perdida'), 0),
                         'em_andamento', coalesce(sum(g.valor) FILTER (WHERE g.status IN ('aberta', 'em_recurso')), 0)) AS x
                  FROM public.conta_glosas g WHERE g.unidade_id = p_unidade GROUP BY g.competencia) k), '[]'::jsonb),
    'por_motivo', coalesce((SELECT jsonb_agg(x ORDER BY (x ->> 'glosado')::numeric DESC) FROM (
                SELECT jsonb_build_object('motivo', g.motivo_codigo, 'quantidade', count(*), 'glosado', sum(g.valor),
                         'recuperado', coalesce(sum(g.valor_recuperado), 0)) AS x
                  FROM public.conta_glosas g WHERE g.unidade_id = p_unidade
                   AND (p_competencia IS NULL OR g.competencia = p_competencia) GROUP BY g.motivo_codigo) k), '[]'::jsonb),
    'totais', (SELECT jsonb_build_object('quantidade', count(*), 'glosado', coalesce(sum(g.valor), 0),
                        'recuperado', coalesce(sum(g.valor_recuperado), 0),
                        'perdido', coalesce(sum(g.valor) FILTER (WHERE g.status = 'perdida'), 0),
                        'em_andamento', coalesce(sum(g.valor) FILTER (WHERE g.status IN ('aberta', 'em_recurso')), 0))
                 FROM public.conta_glosas g WHERE g.unidade_id = p_unidade AND (p_competencia IS NULL OR g.competencia = p_competencia)),
    'pode_conduzir', private.eh_super_admin() OR private.tenho_papel(p_unidade, 'faturamento'),
    'pode_perder', private.eh_super_admin() OR private.gestor_da_unidade(p_unidade));
END $$;
REVOKE ALL ON FUNCTION public.glosas_da_unidade(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.glosas_da_unidade(uuid, text, text) TO authenticated;

-- detalhe com as glosas (substitui a versão da tarefa 5, acrescentando-as)
CREATE OR REPLACE FUNCTION public.conta_detalhe(p_conta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_itens jsonb; v_meds jsonb; v_docs jsonb; v_pend jsonb; v_aberta boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_aberta := c.status IN ('aberta', 'em_conferencia');
  v_itens := coalesce(c.itens_congelados, private.conta_itens(c));
  v_meds := coalesce(c.medicamentos_congelados, private.conta_medicamentos(c));
  v_docs := private.conta_documentos_sus(c);
  -- conta aberta: pendências de agora; fechada: as guardadas no fechamento
  v_pend := CASE WHEN v_aberta THEN private.conta_pendencias(c, v_itens, v_meds, v_docs) ELSE coalesce(c.pendencias_fechamento, '[]'::jsonb) END;
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
    'documentos_sus', v_docs,
    'pendencias', v_pend,
    'pendencias_registradas', v_aberta OR c.pendencias_fechamento IS NOT NULL,
    'bloqueantes_sem_liberacao', CASE WHEN v_aberta THEN jsonb_array_length(private.bloqueantes_sem_liberacao(c, v_pend)) ELSE 0 END,
    'liberacao', CASE WHEN c.liberada_em IS NOT NULL THEN jsonb_build_object(
                   'em', c.liberada_em, 'por', (SELECT nome_completo FROM public.perfis WHERE id = c.liberada_por),
                   'motivo', c.liberacao_motivo, 'pendencias', c.liberacao_pendencias) END,
    'pode_liberar', private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id),
    -- Fase 5B, tarefa 6: glosas da conta
    'glosas', coalesce((SELECT jsonb_agg(private.glosa_json(g) ORDER BY g.registrada_em DESC) FROM public.conta_glosas g WHERE g.conta_id = c.id), '[]'::jsonb),
    'glosaveis', CASE WHEN c.status IN ('fechada', 'faturada') THEN private.glosaveis_da_conta(c) ELSE '[]'::jsonb END);
END $$;
