-- ════════════════════════════════════════════════════════════════════════════
-- Fase 5C, tarefa 5 (RNDS), etapa 5.1: a regulação entra na fila da RNDS no
-- modelo MIRA (Portaria GM/MS 6.656/2025; decisões do RT de 28/10/2026,
-- "1a 2a 3a 4a 5a 6a 7a" e "8a 9a").
--
-- Cada mudança do status MIRA de uma solicitação grava um item 'regulacao' na
-- interop_outbox com o retrato dos dados naquele momento (payload.mira). O
-- documento FHIR (BRRegulacaoAssistencial) é montado a partir desse retrato
-- por src/interop/fhir/regulacao.ts; o envio é a etapa 5.3. Nada sai daqui.
--
--   status do Chefe Coruja                         status MIRA
--   enviada, em_analise, pendencia,
--     aguardando_destino                           pending
--   devolvida                                      returned-to-requester
--   autorizada, agendada, em_transito              booked
--   realizada                                      attended
--   falta                                          absence
--   negada, cancelada                              cancelled
--   excluida                                       excluded
--   rascunho                                       (não vai)
--
-- Modalidade MIRA (só 04 ou 09): leito e transferência são 04; consulta e
-- exame, 09. A coluna modalidade da solicitação não muda.
-- Paciente não identificado, ou sem CPF e sem CNS, não entra na fila; entra
-- quando for identificado. Mudança que não troca o status MIRA (em análise →
-- pendência) não gera item novo. Item ainda pendente é descartado quando chega
-- um status mais novo: o MIRA guarda o estado da solicitação, não o caminho.
-- O gatilho nunca derruba o fluxo da regulação: erro vira aviso no log.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_rnds_regulacao ON public.regulacao_solicitacoes;
--   DROP FUNCTION IF EXISTS private.trg_rnds_regulacao(), private.rnds_enfileirar_regulacao(uuid),
--     private.rnds_mira_regulacao(public.regulacao_solicitacoes), private.rnds_status_mira(text);
--   UPDATE public.interop_outbox SET status = 'descartado', ultimo_erro = 'rollback da 5.1' WHERE tipo_documento = 'regulacao' AND status = 'pendente';
--   ALTER TABLE public.interop_outbox DROP CONSTRAINT interop_outbox_tipo_documento_check;
--   ALTER TABLE public.interop_outbox ADD CONSTRAINT interop_outbox_tipo_documento_check CHECK (tipo_documento IN ('rac', 'sumario_alta')) NOT VALID;
--   (NOT VALID: os itens de regulação já gravados ficam, descartados)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.interop_outbox DROP CONSTRAINT IF EXISTS interop_outbox_tipo_documento_check;
ALTER TABLE public.interop_outbox ADD CONSTRAINT interop_outbox_tipo_documento_check
  CHECK (tipo_documento IN ('rac', 'sumario_alta', 'regulacao'));

CREATE INDEX IF NOT EXISTS interop_outbox_referencia_idx
  ON public.interop_outbox (tipo_documento, referencia_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.rnds_status_mira(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_status IN ('enviada', 'em_analise', 'pendencia', 'aguardando_destino') THEN 'pending'
    WHEN p_status = 'devolvida' THEN 'returned-to-requester'
    WHEN p_status IN ('autorizada', 'agendada', 'em_transito') THEN 'booked'
    WHEN p_status = 'realizada' THEN 'attended'
    WHEN p_status = 'falta' THEN 'absence'
    WHEN p_status IN ('negada', 'cancelada') THEN 'cancelled'
    WHEN p_status = 'excluida' THEN 'excluded'
  END
$$;

-- Retrato MIRA da solicitação; NULL quando ela não vai à RNDS (rascunho,
-- paciente não identificado ou sem CPF e sem CNS).
CREATE OR REPLACE FUNCTION private.rnds_mira_regulacao(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_status text := private.rnds_status_mira(s.status);
  v_cpf text; v_cns text;
  v_cnes_executante text; v_cnes_regulador text; v_cnes_evento text;
BEGIN
  IF v_status IS NULL OR s.paciente_nao_identificado OR s.paciente_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT nullif(regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g'), ''),
         nullif(regexp_replace(coalesce(p.cns, ''), '\D', '', 'g'), '')
    INTO v_cpf, v_cns
    FROM public.pacientes p WHERE p.id = s.paciente_id;
  IF length(v_cpf) IS DISTINCT FROM 11 THEN v_cpf := NULL; END IF;
  IF length(v_cns) IS DISTINCT FROM 15 THEN v_cns := NULL; END IF;
  IF v_cpf IS NULL AND v_cns IS NULL THEN
    RETURN NULL;
  END IF;

  IF s.destino_tipo = 'rede' THEN
    SELECT u.cnes INTO v_cnes_executante FROM public.unidades u WHERE u.id = s.destino_unidade_id;
  END IF;
  SELECT u.cnes INTO v_cnes_regulador FROM public.unidades u WHERE u.id = s.central_id;

  -- quem mudou o status: a origem pede e cancela; a central decide; o destino realiza
  v_cnes_evento := CASE
    WHEN v_status = 'pending' THEN s.cnes_solicitante
    WHEN v_status = 'cancelled' AND s.cancelamento_origem = 'solicitante' THEN s.cnes_solicitante
    WHEN v_status IN ('attended', 'absence') THEN coalesce(v_cnes_executante, v_cnes_regulador, s.cnes_solicitante)
    ELSE coalesce(v_cnes_regulador, s.cnes_solicitante)
  END;

  RETURN jsonb_build_object(
    'solicitacao_id', s.id,
    'numero', s.numero,
    'status', v_status,
    'status_origem', s.status,
    'evento_em', now(),
    'cnes_evento', v_cnes_evento,
    'paciente_cpf', v_cpf,
    'paciente_cns', v_cns,
    'modalidade', CASE WHEN s.tipo IN ('leito', 'transferencia') THEN '04' ELSE '09' END,
    'carater', CASE WHEN s.carater = 'urgencia' THEN 'urgent' ELSE 'routine' END,
    'procedimento', s.procedimento,
    'cbo', s.cbo,
    'cid', nullif(replace(upper(coalesce(s.cid, '')), '.', ''), ''),
    'cnes_solicitante', s.cnes_solicitante,
    'cnes_executante', v_cnes_executante,
    'cnes_regulador', v_cnes_regulador,
    'criada_em', s.criada_em,
    'autorizada_em', s.autorizada_em,
    'data_prevista', s.data_prevista,
    'realizada_em', s.realizada_em
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.rnds_enfileirar_regulacao(p_solicitacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  v_mira jsonb;
  v_ultimo text;
BEGIN
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_solicitacao;
  IF NOT FOUND THEN RETURN; END IF;
  v_mira := private.rnds_mira_regulacao(s);
  IF v_mira IS NULL THEN RETURN; END IF;

  SELECT o.payload -> 'mira' ->> 'status' INTO v_ultimo
    FROM public.interop_outbox o
   WHERE o.tipo_documento = 'regulacao' AND o.referencia_id = s.id AND o.status IN ('pendente', 'enviado')
   ORDER BY o.created_at DESC LIMIT 1;
  IF v_ultimo = v_mira ->> 'status' THEN RETURN; END IF;

  UPDATE public.interop_outbox
     SET status = 'descartado', ultimo_erro = 'substituído por status mais novo'
   WHERE tipo_documento = 'regulacao' AND referencia_id = s.id AND status = 'pendente';

  INSERT INTO public.interop_outbox (unidade_id, tipo_documento, referencia_id, payload, status)
  VALUES (s.unidade_origem_id, 'regulacao', s.id,
          jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'regulacao', 'mira', v_mira),
          'pendente');
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_rnds_regulacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM private.rnds_enfileirar_regulacao(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fila da RNDS (regulação %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.rnds_status_mira(text), private.rnds_mira_regulacao(public.regulacao_solicitacoes),
  private.rnds_enfileirar_regulacao(uuid), private.trg_rnds_regulacao() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_rnds_regulacao ON public.regulacao_solicitacoes;
CREATE TRIGGER trg_rnds_regulacao
  AFTER INSERT OR UPDATE OF status, paciente_id, paciente_nao_identificado ON public.regulacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_rnds_regulacao();
