-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 8 do Portão de 11/10/2026: reabrir o atendimento da porta depois do
-- desfecho. Diagnóstico e decisão do RT (10/11/2026, A em R1 a R10):
--   docs/porta/LACUNA-08-REABRIR-ATENDIMENTO-DIAGNOSTICO.md
--
-- Fontes (conferidas em 10/11/2026; nenhuma norma define a reabertura nem um
-- prazo para ela; a regra "acrescentar sem sobrescrever, com quem, quando e
-- por quê" vem destas):
--   - Código de Ética Médica (Res. CFM 2.217/2018), art. 87, §1º: o registro
--     é cronológico, com data, hora, assinatura e CRM.
--   - Lei 13.787/2018, art. 4º: o prontuário digital é protegido contra
--     alteração não autorizada.
--   - Res. CFM 1.638/2002, art. 5º, I, c: cada registro leva data, hora e a
--     identificação de quem fez.
--   Por isso nada é apagado: o desfecho desfeito vai inteiro para
--   public.episodio_eventos, com quem reabriu (o login), quando e por quê.
--
-- O que faz:
--   R1  public.reabrir_atendimento(episódio, motivo, detalhe): segundo fator;
--       só quem registrou o desfecho (episodios.desfecho_por) ou o gestor da
--       unidade (private.tenho_papel).
--   R2  até 24 h depois do desfecho; depois, a recusa diz que o paciente volta
--       por uma ficha nova.
--   R3  motivo da lista: erro_registro, paciente_voltou, desfecho_errado ou
--       outro (este pede o detalhe com 10 letras ou mais).
--   R4  reabrem: alta, alta após medicação, alta a pedido e evasão; a
--       transferência, só se a saída não foi marcada na regulação (nem a
--       chegada no destino). Não reabrem: óbito, "cancelado" (retirado da
--       fila), quem saiu da fila sem desfecho médico, observação e internação
--       (essas usam o cancelar_alta). Só a porta: a consulta da UBS encerra
--       pela conduta e mexe na agenda, no Hiperdia e no pré-natal (gatilhos que
--       não se desfazem aqui), então fica de fora.
--   R5  o mesmo atendimento volta à etapa "atendimento"; as colunas do
--       desfecho são limpas e a fotografia delas fica em episodio_eventos (só
--       inserção). Recusa se o paciente tem outro atendimento aberto ou está
--       em observação/internação.
--   R6  voltam só as prescrições encerradas por este desfecho que têm item
--       ainda dentro da validade (lacuna 6: valida_ate; o "Agora", sem
--       validade, conta 24 h da prescrição); o item vencido e o de contenção
--       ficam suspensos com o motivo. Não voltam: exames e pareceres
--       cancelados, isolamento, contenção e o rascunho do SOAP. A prévia
--       (reabrir_atendimento_previa) e a resposta listam o que não volta.
--   R7  conta fechada/faturada ou competência do BPA fechada: recusa até o
--       faturamento ou o gestor reabrir. RAC ainda não enviado à RNDS:
--       descartado; já enviado: fica e o evento registra. Webhook novo
--       "atendimento.reaberto" (catálogo private.webhook_tipos). A
--       contrarreferência à UBS gerada por este desfecho é cancelada, como na
--       alta desfeita da internação. Documentos emitidos continuam valendo (a
--       tela lista; o médico cancela pelo fluxo de sempre).
--   R8  reaberturas em prontuario_leitura (chave "reaberturas") e auditoria só
--       com ids e códigos.
--   R10 cancelar_alta: gestor por private.tenho_papel, não por
--       papel_na_unidade(...) = 'gestor' (que devolve o papel de maior peso:
--       quem é admin e gestor ficava de fora). Só isso muda nela.
--
-- Funções trocadas trecho a trecho pelo texto atual (pg_get_functiondef),
-- como em 20270327000001: trecho que sumiu para a migration com erro; trecho
-- já trocado é pulado (reaplicável); corpo CRLF continua CRLF. Conferido em
-- 10/11/2026 na homologação: cancelar_alta, prontuario_leitura e
-- private.webhook_tipos (md5 antes e depois no diagnóstico, seção 6).
--
-- Só expande: tabela, índices, funções e políticas novas; três funções com o
-- corpo trocado. Nenhuma coluna de episodios muda.
-- Teste: supabase/tests/reabrir_atendimento.sql
--
-- Rollback (testado na homologação, em transação desfeita; o md5 das funções
-- trocadas volta ao de antes): o bloco comentado no fim deste arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── R5: eventos do atendimento (só inserção) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episodio_eventos (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episodio_id                 uuid NOT NULL REFERENCES public.episodios(id),
  unidade_id                  uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id                 uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  tipo                        text NOT NULL CHECK (tipo IN ('reabertura')),
  autor_id                    uuid NOT NULL REFERENCES public.perfis(id),
  criado_em                   timestamptz NOT NULL DEFAULT now(),
  motivo                      text CHECK (motivo IN ('erro_registro', 'paciente_voltou', 'desfecho_errado', 'outro')),
  detalhe                     text CHECK (length(detalhe) <= 500),
  -- a fotografia do desfecho desfeito (nada é apagado)
  desfecho_anterior           text,
  desfecho_anterior_motivo    text,
  desfecho_anterior_detalhes  jsonb,
  desfecho_anterior_em        timestamptz,
  desfecho_anterior_por       uuid REFERENCES public.perfis(id),
  encerrado_anterior_em       timestamptz,
  encerrado_anterior_por      uuid REFERENCES public.perfis(id),
  -- o que voltou e o que não voltou, RAC, contrarreferência, documentos
  efeitos                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (tipo <> 'reabertura' OR (motivo IS NOT NULL AND desfecho_anterior IS NOT NULL AND desfecho_anterior_em IS NOT NULL)),
  CHECK (motivo IS DISTINCT FROM 'outro' OR length(btrim(coalesce(detalhe, ''))) >= 10)
);
COMMENT ON TABLE public.episodio_eventos IS
  'Eventos do atendimento da porta (lacuna 8): a reabertura, com o desfecho desfeito inteiro, quem reabriu (login), quando e o motivo. Só inserção, pelo servidor (CEM art. 87; Lei 13.787/2018, art. 4º).';
CREATE INDEX IF NOT EXISTS episodio_eventos_episodio_idx ON public.episodio_eventos (episodio_id, criado_em);
CREATE INDEX IF NOT EXISTS episodio_eventos_unidade_id_fk_idx ON public.episodio_eventos (unidade_id);
CREATE INDEX IF NOT EXISTS episodio_eventos_paciente_id_fk_idx ON public.episodio_eventos (paciente_id);
CREATE INDEX IF NOT EXISTS episodio_eventos_autor_id_fk_idx ON public.episodio_eventos (autor_id);
CREATE INDEX IF NOT EXISTS episodio_eventos_desfecho_anterior_por_fk_idx ON public.episodio_eventos (desfecho_anterior_por);
CREATE INDEX IF NOT EXISTS episodio_eventos_encerrado_anterior_por_fk_idx ON public.episodio_eventos (encerrado_anterior_por);

-- leitura como a do atendimento (o RLS de episodios decide); escrita só pelo servidor
ALTER TABLE public.episodio_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.episodio_eventos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.episodio_eventos TO authenticated;
DROP POLICY IF EXISTS episodio_eventos_select ON public.episodio_eventos;
CREATE POLICY episodio_eventos_select ON public.episodio_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = episodio_eventos.episodio_id));
DROP POLICY IF EXISTS episodio_eventos_segundo_fator ON public.episodio_eventos;
CREATE POLICY episodio_eventos_segundo_fator ON public.episodio_eventos AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- só inserção: nem o dono troca o que foi gravado; DELETE pela guarda de 20 anos
CREATE OR REPLACE FUNCTION private.episodio_eventos_so_insercao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Evento do atendimento não se altera: o registro é só de inserção (Lei 13.787/2018, art. 4º).'
    USING ERRCODE = '42501';
END $$;
REVOKE ALL ON FUNCTION private.episodio_eventos_so_insercao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_episodio_eventos_so_insercao ON public.episodio_eventos;
CREATE TRIGGER trg_episodio_eventos_so_insercao BEFORE UPDATE ON public.episodio_eventos
  FOR EACH ROW EXECUTE FUNCTION private.episodio_eventos_so_insercao();
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.episodio_eventos;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.episodio_eventos
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- ── R6: o item que volta ────────────────────────────────────────────────────
-- Medicamento ou cuidado, não suspenso, dentro da validade (lacuna 6). O
-- "Agora" não tem validade: vale 24 h da prescrição (COFEN 689/2022, art. 4º).
-- Contenção não volta: ela terminou com o desfecho.
CREATE OR REPLACE FUNCTION private.reabertura_item_volta(p_tipo text, p_suspenso_em timestamptz, p_valida_ate timestamptz, p_criado_em timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p_suspenso_em IS NULL AND p_tipo IN ('medicamento', 'cuidado')
     AND CASE WHEN p_valida_ate IS NULL THEN p_criado_em > now() - interval '24 hours' ELSE p_valida_ate > now() END
$$;
REVOKE ALL ON FUNCTION private.reabertura_item_volta(text, timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- ── R1, R2, R4, R5, R7: por que não reabre (nulo = pode) ────────────────────
CREATE OR REPLACE FUNCTION private.reabertura_recusa(e public.episodios)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_desde timestamptz := coalesce(e.encerrado_em, e.desfecho_em);
  v_reg uuid;
BEGIN
  -- ainda aberto (nem desfecho): nada a reabrir
  IF e.desfecho IS NULL AND e.etapa <> 'encerrado' THEN RETURN 'O atendimento não está encerrado.'; END IF;
  -- R1: o autor do desfecho ou o gestor da unidade (pelo vínculo)
  IF v_eu IS NULL OR NOT (e.desfecho_por IS NOT DISTINCT FROM v_eu OR private.tenho_papel(e.unidade_id, 'gestor')) THEN
    RETURN 'Só quem registrou o desfecho, ou o gestor da unidade, reabre o atendimento.';
  END IF;
  -- R4: só a porta
  IF e.tipo_atendimento_aps IS NOT NULL OR EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = e.unidade_id AND u.tipo::text = 'ubs') THEN
    RETURN 'Na UBS, a consulta encerrada não se reabre: registre uma nova consulta.';
  END IF;
  IF e.desfecho IN ('observacao', 'internacao') THEN
    RETURN 'O paciente foi para observação ou internação: a alta de lá se desfaz pelo "Cancelar alta".';
  END IF;
  IF e.etapa <> 'encerrado' THEN RETURN 'O atendimento não está encerrado.'; END IF;
  IF e.desfecho = 'obito' THEN RETURN 'Atendimento encerrado por óbito não se reabre.'; END IF;
  IF e.desfecho IS NULL OR e.desfecho = 'cancelado' OR e.desfecho_por IS NULL THEN
    RETURN 'O paciente saiu da fila sem desfecho médico: ele volta por uma ficha nova.';
  END IF;
  IF e.desfecho NOT IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'evasao', 'transferencia') THEN
    RETURN 'Este desfecho não se reabre.';
  END IF;
  -- R2
  IF v_desde IS NULL OR v_desde < now() - interval '24 hours' THEN
    RETURN 'O desfecho tem mais de 24 horas: o atendimento não se reabre e o paciente volta por uma ficha nova.';
  END IF;
  -- R5: um atendimento aberto por paciente
  IF EXISTS (SELECT 1 FROM public.episodios o WHERE o.paciente_id = e.paciente_id AND o.id <> e.id AND o.etapa <> 'encerrado') THEN
    RETURN 'O paciente já tem outro atendimento aberto: continue por ele.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = e.paciente_id AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
    RETURN 'O paciente está em observação ou internado: continue por lá.';
  END IF;
  -- R7: faturamento
  IF EXISTS (SELECT 1 FROM public.contas c WHERE c.episodio_id = e.id AND c.status IN ('fechada', 'faturada')) THEN
    RETURN 'A conta deste atendimento está fechada: o faturamento ou o gestor reabre a conta antes.';
  END IF;
  IF private.competencia_fechada(e.unidade_id, private.competencia_de(coalesce(e.atendimento_iniciado_em, e.chegada_em)))
     OR private.competencia_fechada(e.unidade_id, private.competencia_de(v_desde)) THEN
    RETURN 'A competência do BPA deste atendimento está fechada: o faturamento reabre a competência antes.';
  END IF;
  -- R4/R7: transferência só sem a saída marcada (nem a chegada no destino)
  IF e.desfecho = 'transferencia' THEN
    v_reg := CASE WHEN coalesce(e.desfecho_detalhes ->> 'regulacao_id', '') ~ '^[0-9a-fA-F-]{36}$'
                  THEN (e.desfecho_detalhes ->> 'regulacao_id')::uuid END;
    IF EXISTS (SELECT 1 FROM public.regulacao_solicitacoes s
                WHERE s.tipo IN ('leito', 'transferencia')
                  AND (s.saida_em IS NOT NULL OR s.chegada_em IS NOT NULL)
                  AND (s.id = v_reg OR s.episodio_id = e.id
                       OR (s.paciente_id = e.paciente_id AND s.unidade_origem_id = e.unidade_id
                           AND coalesce(s.saida_em, s.chegada_em) >= e.chegada_em))) THEN
      RETURN 'A saída do paciente já foi marcada na regulação: a transferência não se reabre.';
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.reabertura_recusa(public.episodios) FROM PUBLIC, anon, authenticated;

-- ── R6/R7: o que volta e o que não volta (lido antes de mexer) ──────────────
-- Tudo o que o desfecho fechou tem a hora dele (mesma transação: now() igual).
CREATE OR REPLACE FUNCTION private.reabertura_impacto(e public.episodios)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH desde AS (SELECT coalesce(e.desfecho_em, e.encerrado_em) AS t),
  pr AS (SELECT p.id FROM public.prescricoes p, desde
          WHERE p.episodio_id = e.id AND p.status = 'encerrada' AND p.encerrada_em >= desde.t),
  it AS (SELECT i.id, i.prescricao_id, i.descricao, i.tipo,
                private.reabertura_item_volta(i.tipo, i.suspenso_em, i.valida_ate, i.created_at) AS volta
           FROM public.prescricao_itens i WHERE i.prescricao_id IN (SELECT id FROM pr) AND i.suspenso_em IS NULL)
  SELECT jsonb_build_object(
    'itens_voltam', coalesce((SELECT jsonb_agg(jsonb_build_object('id', it.id, 'descricao', it.descricao) ORDER BY it.descricao, it.id)
                                FROM it WHERE it.volta), '[]'::jsonb),
    'itens_nao_voltam', coalesce((SELECT jsonb_agg(jsonb_build_object('id', it.id, 'descricao', it.descricao,
                                                     'motivo', CASE WHEN it.tipo = 'contencao' THEN 'contencao' ELSE 'vencido' END)
                                                   ORDER BY it.descricao, it.id)
                                    FROM it WHERE NOT it.volta), '[]'::jsonb),
    'exames_cancelados', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'exame', x.exame) ORDER BY x.exame, x.id)
                                     FROM public.exames_pedidos x, desde
                                    WHERE x.episodio_id = e.id AND x.situacao = 'cancelado' AND x.resolvido_em >= desde.t), '[]'::jsonb),
    'pareceres_cancelados', coalesce((SELECT jsonb_agg(jsonb_build_object('id', pm.id, 'especialidade', pm.especialidade) ORDER BY pm.especialidade, pm.id)
                                        FROM public.pareceres_medicos pm, desde
                                       WHERE pm.episodio_id = e.id AND pm.status = 'cancelado' AND pm.cancelado_em >= desde.t), '[]'::jsonb),
    'isolamentos_encerrados', coalesce((SELECT jsonb_agg(jsonb_build_object('id', iso.id, 'tipo', iso.tipo) ORDER BY iso.marcado_em, iso.id)
                                          FROM public.isolamentos_paciente iso, desde
                                         WHERE iso.paciente_id = e.paciente_id AND iso.retirado_em >= desde.t
                                           AND iso.motivo_retirada = 'Encerrado com o desfecho do atendimento'), '[]'::jsonb),
    'contencoes_encerradas', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id) ORDER BY c.iniciada_em, c.id)
                                         FROM public.contencoes c, desde
                                        WHERE c.paciente_id = e.paciente_id AND c.retirada_em >= desde.t
                                          AND c.motivo_retirada = 'Encerrada com o desfecho do atendimento'), '[]'::jsonb),
    'documentos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'tipo_documento', d.tipo_documento, 'numero', d.numero,
                                                                'emitido_em', coalesce(d.emitido_em, d.created_at))
                                             ORDER BY coalesce(d.emitido_em, d.created_at), d.id)
                              FROM public.documentos_clinicos d
                             WHERE d.episodio_id = e.id AND d.estado IN ('ativo', 'assinado') AND d.cancelado_em IS NULL), '[]'::jsonb),
    'rac_enviado', EXISTS (SELECT 1 FROM public.interop_outbox o WHERE o.tipo_documento = 'rac' AND o.referencia_id = e.id AND o.status = 'enviado'),
    'contrarreferencias', (SELECT count(*) FROM public.contrarreferencias x WHERE x.episodio_id = e.id AND x.situacao <> 'cancelada'))
$$;
REVOKE ALL ON FUNCTION private.reabertura_impacto(public.episodios) FROM PUBLIC, anon, authenticated;

-- ── R9: a prévia da tela (o que não volta, antes de confirmar) ──────────────
CREATE OR REPLACE FUNCTION public.reabrir_atendimento_previa(p_episodio uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios; v_recusa text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;
  v_recusa := private.reabertura_recusa(e);
  -- quem não pode reabrir recebe só a recusa
  RETURN jsonb_build_object('pode', v_recusa IS NULL, 'recusa', v_recusa)
      || CASE WHEN v_recusa IS NULL THEN
           jsonb_build_object('desfecho', e.desfecho, 'desfecho_em', e.desfecho_em,
                              'prazo_ate', coalesce(e.encerrado_em, e.desfecho_em) + interval '24 hours')
           || private.reabertura_impacto(e)
         ELSE '{}'::jsonb END;
END $$;
REVOKE ALL ON FUNCTION public.reabrir_atendimento_previa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_atendimento_previa(uuid) TO authenticated;

-- ── R1 a R8: reabrir ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reabrir_atendimento(p_episodio uuid, p_motivo text, p_detalhe text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_eu uuid := private.meu_perfil_id();
  v_recusa text;
  v_detalhe text := nullif(btrim(coalesce(p_detalhe, '')), '');
  v_desde timestamptz;
  v_impacto jsonb;
  v_rac integer;
  v_contra integer;
  v_presc integer := 0;
  v_evento uuid;
  v_efeitos jsonb;
  pr record;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;
  v_recusa := private.reabertura_recusa(e);
  IF v_recusa IS NOT NULL THEN RAISE EXCEPTION '%', v_recusa USING ERRCODE = 'check_violation'; END IF;
  -- R3
  IF p_motivo IS NULL OR p_motivo NOT IN ('erro_registro', 'paciente_voltou', 'desfecho_errado', 'outro') THEN
    RAISE EXCEPTION 'Escolha o motivo da reabertura.';
  END IF;
  IF p_motivo = 'outro' AND length(coalesce(v_detalhe, '')) < 10 THEN
    RAISE EXCEPTION 'Motivo "outro": descreva o motivo (mínimo de 10 letras).';
  END IF;
  IF length(coalesce(v_detalhe, '')) > 500 THEN RAISE EXCEPTION 'O detalhe do motivo passa de 500 letras.'; END IF;

  v_desde := coalesce(e.desfecho_em, e.encerrado_em);
  v_impacto := private.reabertura_impacto(e);

  -- R6: a prescrição encerrada por este desfecho volta se tem item na validade;
  -- o item vencido e o de contenção ficam suspensos (não voltam)
  FOR pr IN SELECT p.id, p.unidade_id FROM public.prescricoes p
             WHERE p.episodio_id = e.id AND p.status = 'encerrada' AND p.encerrada_em >= v_desde
             ORDER BY p.created_at FOR UPDATE LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.prescricao_itens i WHERE i.prescricao_id = pr.id
                                AND private.reabertura_item_volta(i.tipo, i.suspenso_em, i.valida_ate, i.created_at));
    UPDATE public.prescricao_itens i
       SET suspenso_em = now(), suspenso_por = v_eu,
           motivo_suspensao = CASE WHEN i.tipo = 'contencao'
                                   THEN 'Não voltou com a reabertura do atendimento: a contenção terminou no desfecho.'
                                   ELSE 'Não voltou com a reabertura do atendimento: prescrição vencida (Resolução COFEN 689/2022, art. 4º).' END
     WHERE i.prescricao_id = pr.id AND i.suspenso_em IS NULL
       AND NOT private.reabertura_item_volta(i.tipo, i.suspenso_em, i.valida_ate, i.created_at);
    UPDATE public.prescricoes
       SET status = 'ativa', encerrada_em = NULL, encerrada_por = NULL, motivo_encerramento = NULL, updated_at = now()
     WHERE id = pr.id;
    v_presc := v_presc + 1;
    PERFORM private.registrar_auditoria('reabrir_prescricao', 'prescricoes', pr.id, pr.unidade_id,
      jsonb_build_object('status', 'ativa', 'motivo_codigo', 'reabertura_atendimento'));
  END LOOP;

  -- R7: o RAC ainda não enviado sai da fila da RNDS; o enviado fica (o evento registra)
  UPDATE public.interop_outbox SET status = 'descartado', ultimo_erro = 'atendimento reaberto'
   WHERE tipo_documento = 'rac' AND referencia_id = e.id AND status IN ('pendente', 'retido', 'erro');
  GET DIAGNOSTICS v_rac = ROW_COUNT;
  -- R7: a contrarreferência deste desfecho é cancelada (como na alta desfeita da internação)
  UPDATE public.contrarreferencias SET situacao = 'cancelada', cancelada_em = now()
   WHERE episodio_id = e.id AND situacao <> 'cancelada';
  GET DIAGNOSTICS v_contra = ROW_COUNT;

  v_efeitos := v_impacto || jsonb_build_object('prescricoes_reativadas', v_presc, 'rac_descartado', v_rac > 0,
                                               'contrarreferencias_canceladas', v_contra);
  -- R5: a fotografia do desfecho desfeito, com quem reabriu (login), quando e por quê
  INSERT INTO public.episodio_eventos (episodio_id, unidade_id, paciente_id, tipo, autor_id, motivo, detalhe,
    desfecho_anterior, desfecho_anterior_motivo, desfecho_anterior_detalhes, desfecho_anterior_em, desfecho_anterior_por,
    encerrado_anterior_em, encerrado_anterior_por, efeitos)
  VALUES (e.id, e.unidade_id, e.paciente_id, 'reabertura', v_eu, p_motivo, v_detalhe,
    e.desfecho, e.desfecho_motivo, e.desfecho_detalhes, coalesce(e.desfecho_em, e.encerrado_em), e.desfecho_por,
    e.encerrado_em, e.encerrado_por, v_efeitos)
  RETURNING id INTO v_evento;

  UPDATE public.episodios
     SET etapa = 'atendimento', desfecho = NULL, desfecho_motivo = NULL, desfecho_detalhes = NULL,
         desfecho_em = NULL, desfecho_por = NULL, encerrado_em = NULL, encerrado_por = NULL,
         reavaliar_em = NULL, updated_at = now()
   WHERE id = e.id;

  -- R7: webhook enxuto (só ids), como os outros eventos do atendimento
  PERFORM private.webhook_emitir(e.unidade_id, 'atendimento.reaberto', e.id,
    jsonb_build_object('atendimento_id', e.id, 'paciente_id', e.paciente_id));
  -- R8: auditoria só com ids e códigos
  PERFORM private.registrar_auditoria('reabrir_atendimento', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', 'atendimento', 'tipo', e.desfecho, 'motivo_codigo', p_motivo, 'anterior', v_evento,
                       'quantidade', jsonb_array_length(v_impacto -> 'itens_voltam')));
  RETURN jsonb_build_object('episodio_id', e.id, 'evento_id', v_evento) || v_efeitos;
END $$;
REVOKE ALL ON FUNCTION public.reabrir_atendimento(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_atendimento(uuid, text, text) TO authenticated;

-- ── funções trocadas trecho a trecho ────────────────────────────────────────
-- pula o que já foi trocado; trecho que sumiu (ou aparece mais de uma vez) para com erro.
-- Corpo gravado com quebra de linha CRLF continua CRLF (o rollback volta ao mesmo md5).
CREATE OR REPLACE FUNCTION pg_temp.trocar_reabrir(f regprocedure, trechos text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
  v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
BEGIN
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
    v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
    IF position(v_novo IN def) > 0 THEN CONTINUE; END IF;
    IF position(v_ant IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, v_ant;
    END IF;
    IF (length(def) - length(replace(def, v_ant, ''))) / length(v_ant) <> 1 THEN
      RAISE EXCEPTION '%: trecho aparece mais de uma vez: %', f, v_ant;
    END IF;
    def := replace(def, v_ant, v_novo);
    mudou := true;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;

-- R10: cancelar_alta confere o gestor pelo vínculo
SELECT pg_temp.trocar_reabrir('public.cancelar_alta(uuid, text)'::regprocedure, ARRAY[
  $a$  IF NOT (i.alta_por = v_perfil OR private.papel_na_unidade(i.unidade_id) = 'gestor') THEN
$a$,
  $b$  -- lacuna 8 (R10): o gestor pelo vínculo (papel_na_unidade devolve só o papel de maior peso)
  IF NOT (i.alta_por = v_perfil OR private.tenho_papel(i.unidade_id, 'gestor')) THEN
$b$]);

-- R8: as reaberturas na linha do tempo do prontuário (lidas pelo RLS de quem lê)
SELECT pg_temp.trocar_reabrir('public.prontuario_leitura(uuid, timestamptz, integer)'::regprocedure, ARRAY[
  $a$        LEFT JOIN public.conceito c ON c.id = o.conceito_id), '[]'::jsonb)
  ) INTO v_dados;
$a$,
  $b$        LEFT JOIN public.conceito c ON c.id = o.conceito_id), '[]'::jsonb),

    -- lacuna 8 (R8): reaberturas do atendimento, com o desfecho desfeito; medico_id
    -- é quem registrou o desfecho desfeito (o nome vem em "nomes")
    'reaberturas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id, 'episodio_id', r.episodio_id, 'criado_em', r.criado_em, 'autor_id', r.autor_id,
               'motivo', r.motivo, 'detalhe', r.detalhe, 'desfecho_anterior', r.desfecho_anterior,
               'desfecho_anterior_em', r.desfecho_anterior_em, 'medico_id', r.desfecho_anterior_por,
               'cid_anterior', nullif(r.desfecho_anterior_detalhes ->> 'cid_alta', ''))
             ORDER BY r.criado_em)
        FROM public.episodio_eventos r WHERE r.episodio_id = ANY (v_eps) AND r.tipo = 'reabertura'), '[]'::jsonb)
  ) INTO v_dados;
$b$]);

-- R7: o evento novo no catálogo dos webhooks (o cadastro do destino aceita)
SELECT pg_temp.trocar_reabrir('private.webhook_tipos()'::regprocedure, ARRAY[
  $a$'internacao.alta', 'prescricao.assinada', 'regulacao.status_alterado']::text[]$a$,
  $b$'internacao.alta', 'prescricao.assinada', 'regulacao.status_alterado', 'atendimento.reaberto']::text[]$b$]);

DROP FUNCTION pg_temp.trocar_reabrir(regprocedure, text[]);

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (rodar inteiro; testado na homologação em transação desfeita):
--
-- CREATE OR REPLACE FUNCTION pg_temp.desfazer_reabrir(f regprocedure, trechos text[])
-- RETURNS void LANGUAGE plpgsql AS $$
-- DECLARE def text := pg_get_functiondef(f); i int; mudou boolean := false; v_ant text; v_novo text;
--   v_fim text := CASE WHEN position(E'\r\n' IN pg_get_functiondef(f)) > 0 THEN E'\r\n' ELSE E'\n' END;
-- BEGIN
--   FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
--     v_ant := replace(replace(trechos[i], E'\r', ''), E'\n', v_fim);
--     v_novo := replace(replace(trechos[i + 1], E'\r', ''), E'\n', v_fim);
--     IF position(v_novo IN def) > 0 THEN
--       def := replace(def, v_novo, v_ant);
--       mudou := true;
--     END IF;
--   END LOOP;
--   IF mudou THEN EXECUTE def; END IF;
-- END $$;
-- -- as três chamadas pg_temp.trocar_reabrir acima, iguais, com o nome
-- -- pg_temp.desfazer_reabrir (os mesmos pares: ele troca o novo pelo antigo).
-- -- Antes de tirar o evento do catálogo, nenhum destino pode pedi-lo:
-- UPDATE public.webhook_destinos SET eventos = array_remove(eventos, 'atendimento.reaberto')
--  WHERE 'atendimento.reaberto' = ANY (eventos) AND cardinality(eventos) > 1;
-- DROP FUNCTION IF EXISTS public.reabrir_atendimento(uuid, text, text), public.reabrir_atendimento_previa(uuid),
--   private.reabertura_impacto(public.episodios), private.reabertura_recusa(public.episodios),
--   private.reabertura_item_volta(text, timestamptz, timestamptz, timestamptz);
-- -- a tabela public.episodio_eventos fica (dado clínico: o desfecho desfeito e
-- -- quem reabriu) até uma janela declarada (contract); os eventos já gravados
-- -- em webhook_eventos com o tipo novo ficam como estão.
-- ════════════════════════════════════════════════════════════════════════════
