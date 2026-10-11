-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 9 — aceite pela unidade destino (decisões do RT de
-- 11/10/2026, BACKLOG.md).
--
-- • A central autoriza para uma unidade da rede e o pedido fica "aguardando o
--   destino". O destino (médico plantonista ou gestor) aceita ou recusa com
--   motivo da lista e texto. Na recusa, o pedido volta à fila da central.
-- • No pedido de leito, quem aceita escolhe um leito livre do destino, que
--   fica reservado para o pedido (reserva do mapa de leitos).
-- • Prazo de resposta do destino: 24 h, só alerta, ajustável pela central
--   (relógios da tarefa 7).
-- • Chegada: a origem marca "saiu" (em trânsito); o destino marca "chegou"
--   (realizada) ou "não chegou" (falta).
-- • Destino fora da rede: a central registra a resposta (quem confirmou, hora
--   e meio) e a chegada.
-- • Avisos: destino, origem e regulador.
-- • A origem pode cancelar também enquanto espera o destino ou a chegada; a
--   reserva do leito é liberada.
-- ════════════════════════════════════════════════════════════════════════════

-- ── status e colunas ────────────────────────────────────────────────────────
ALTER TABLE public.regulacao_solicitacoes DROP CONSTRAINT IF EXISTS regulacao_solicitacoes_status_check;
ALTER TABLE public.regulacao_solicitacoes ADD CONSTRAINT regulacao_solicitacoes_status_check
  CHECK (status IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada',
                    'em_transito', 'realizada', 'falta', 'negada', 'cancelada', 'excluida'));
ALTER TABLE public.regulacao_solicitacoes
  ADD COLUMN IF NOT EXISTS destino_enviado_em      timestamptz,
  ADD COLUMN IF NOT EXISTS destino_resposta        text CHECK (destino_resposta IN ('aceita', 'recusada')),
  ADD COLUMN IF NOT EXISTS destino_respondido_em   timestamptz,
  ADD COLUMN IF NOT EXISTS destino_respondido_por  uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS reserva_id              uuid REFERENCES public.reservas_leito(id),
  ADD COLUMN IF NOT EXISTS saida_em                timestamptz,
  ADD COLUMN IF NOT EXISTS saida_por               uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS chegada_por             uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS falta_em                timestamptz,
  ADD COLUMN IF NOT EXISTS chegada_observacao      text;

-- cada resposta do destino (aceite ou recusa), só inserção
CREATE TABLE IF NOT EXISTS public.regulacao_destino_respostas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id      uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  destino_tipo        text NOT NULL CHECK (destino_tipo IN ('rede', 'externo')),
  destino_unidade_id  uuid REFERENCES public.unidades(id),
  destino_externo     text,
  resposta            text NOT NULL CHECK (resposta IN ('aceita', 'recusada')),
  motivo              text CHECK (motivo IN ('sem_vaga', 'sem_recurso', 'perfil_incompativel', 'outro')),
  texto               text,
  leito_id            uuid REFERENCES public.leitos(id),
  por                 uuid NOT NULL REFERENCES public.perfis(id),
  por_registro        text,                 -- CRM/UF de quem respondeu, quando médico
  externo_quem        text,                 -- destino de fora: quem confirmou
  externo_meio        text CHECK (externo_meio IN ('telefone', 'sistema_externo', 'presencial', 'outro')),
  em                  timestamptz NOT NULL DEFAULT now(),
  CHECK (resposta = 'aceita' OR (motivo IS NOT NULL AND length(btrim(coalesce(texto, ''))) >= 10)),
  CHECK (destino_tipo = 'rede' OR (length(btrim(coalesce(externo_quem, ''))) >= 3 AND externo_meio IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_regulacao_destino_respostas ON public.regulacao_destino_respostas (solicitacao_id, em);
DROP TRIGGER IF EXISTS trg_regulacao_destino_respostas_so_insercao ON public.regulacao_destino_respostas;
CREATE TRIGGER trg_regulacao_destino_respostas_so_insercao BEFORE UPDATE OR DELETE ON public.regulacao_destino_respostas
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.regulacao_destino_respostas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_destino_respostas FROM anon, authenticated;

-- prazo de resposta do destino (relógios da tarefa 7)
ALTER TABLE public.regulacao_prazos
  ADD COLUMN IF NOT EXISTS destino_h integer NOT NULL DEFAULT 24 CHECK (destino_h BETWEEN 1 AND 168);

-- ── apoio ───────────────────────────────────────────────────────────────────
-- Responde pelo destino da rede: médico plantonista ou gestor da unidade.
CREATE OR REPLACE FUNCTION private.regulacao_sou_destino(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.destino_unidade_id IS NOT NULL
     AND (private.tenho_papel(s.destino_unidade_id, 'plantonista') OR private.tenho_papel(s.destino_unidade_id, 'gestor'))
$$;
REVOKE ALL ON FUNCTION private.regulacao_sou_destino(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- o destino vê o pedido enquanto ele é dele
CREATE OR REPLACE FUNCTION private.regulacao_pode_ver(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin()
      OR private.tenho_papel(s.unidade_origem_id, 'plantonista') OR private.tenho_papel(s.unidade_origem_id, 'gestor')
      OR private.tenho_papel(s.central_id, 'regulador') OR private.tenho_papel(s.central_id, 'gestor')
      OR (s.status IN ('aguardando_destino', 'autorizada', 'agendada', 'em_transito', 'realizada', 'falta')
          AND private.regulacao_sou_destino(s))
$$;

-- avisa médicos e gestores da unidade destino
CREATE OR REPLACE FUNCTION private.regulacao_avisar_destino(s public.regulacao_solicitacoes, p_tipo text, p_mensagem text, p_reabrir boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF s.destino_unidade_id IS NULL THEN RETURN; END IF;
  IF p_reabrir THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    SELECT DISTINCT vi.perfil_id, s.destino_unidade_id, current_date, p_tipo || '_' || s.numero, p_mensagem
      FROM public.vinculos vi
     WHERE vi.unidade_id = s.destino_unidade_id AND vi.ativo AND vi.papel IN ('plantonista', 'gestor')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  ELSE
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    SELECT DISTINCT vi.perfil_id, s.destino_unidade_id, current_date, p_tipo || '_' || s.numero, p_mensagem
      FROM public.vinculos vi
     WHERE vi.unidade_id = s.destino_unidade_id AND vi.ativo AND vi.papel IN ('plantonista', 'gestor')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_avisar_destino(public.regulacao_solicitacoes, text, text, boolean) FROM PUBLIC, anon, authenticated;

-- avisa o regulador que está com o pedido (ou que autorizou)
CREATE OR REPLACE FUNCTION private.regulacao_avisar_regulador(s public.regulacao_solicitacoes, p_tipo text, p_mensagem text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, s.central_id, current_date, p_tipo || '_' || s.numero, p_mensagem
    FROM unnest(ARRAY[s.assumida_por, s.autorizada_por]) q WHERE q IS NOT NULL
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now()
$$;
REVOKE ALL ON FUNCTION private.regulacao_avisar_regulador(public.regulacao_solicitacoes, text, text) FROM PUBLIC, anon, authenticated;

-- encerra a reserva do pedido, se ainda ativa, e libera o leito
CREATE OR REPLACE FUNCTION private.regulacao_liberar_reserva(s public.regulacao_solicitacoes, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.reservas_leito;
BEGIN
  IF s.reserva_id IS NULL THEN RETURN; END IF;
  SELECT * INTO r FROM public.reservas_leito WHERE id = s.reserva_id AND situacao = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.reservas_leito SET situacao = 'cancelada', encerrada_em = now(), encerrada_por = private.meu_perfil_id(),
         motivo_encerramento = p_motivo WHERE id = r.id;
  PERFORM set_config('cc.reserva_encerrada', r.leito_id::text, true);
  UPDATE public.leitos SET status = 'livre' WHERE id = r.leito_id AND status = 'reservado';
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (r.leito_id, r.unidade_id, 'cancelamento_reserva', 'reservado', 'livre', coalesce(private.meu_perfil_id(), r.reservado_por), p_motivo);
END $$;
REVOKE ALL ON FUNCTION private.regulacao_liberar_reserva(public.regulacao_solicitacoes, text) FROM PUBLIC, anon, authenticated;

-- mantém a reserva valendo por mais p_horas (sem encurtar)
CREATE OR REPLACE FUNCTION private.regulacao_estender_reserva(s public.regulacao_solicitacoes, p_horas integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.reservas_leito SET expira_em = greatest(expira_em, now() + make_interval(hours => p_horas))
   WHERE id = s.reserva_id AND situacao = 'ativa'
$$;
REVOKE ALL ON FUNCTION private.regulacao_estender_reserva(public.regulacao_solicitacoes, integer) FROM PUBLIC, anon, authenticated;

-- ── prazos (tarefa 7) com o do destino ──────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_prazos_de(p_central uuid)
RETURNS public.regulacao_prazos LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.regulacao_prazos;
BEGIN
  SELECT * INTO p FROM public.regulacao_prazos WHERE central_id = p_central;
  IF NOT FOUND THEN
    p.central_id := p_central; p.evolucao_h := 12; p.pendencia_h := 3; p.sem_evolucao_h := 72; p.destino_h := 24;
  END IF;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION private.regulacao_prazos_json(p_central uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.regulacao_prazos;
BEGIN
  p := private.regulacao_prazos_de(p_central);
  RETURN jsonb_build_object(
    'central_id', p_central,
    'fila', jsonb_build_object('emergencia', p.fila_emergencia_min, 'urgencia', p.fila_urgencia_min,
                               'prioritaria', p.fila_prioritaria_min, 'eletiva', p.fila_eletiva_min),
    'evolucao_h', p.evolucao_h, 'pendencia_h', p.pendencia_h, 'sem_evolucao_h', p.sem_evolucao_h, 'destino_h', p.destino_h,
    'ajustado', p.atualizado_por IS NOT NULL,
    'atualizado_em', CASE WHEN p.atualizado_por IS NOT NULL THEN p.atualizado_em END,
    'atualizado_por', (SELECT pe.nome_completo FROM public.perfis pe WHERE pe.id = p.atualizado_por));
END $$;

CREATE OR REPLACE FUNCTION public.regulacao_definir_prazos(p_central uuid, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_antes jsonb;
  v_min integer[];
  v_evol integer; v_pend integer; v_sem integer; v_dest integer;
  v_hist uuid;
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_central) THEN
    RAISE EXCEPTION 'Esta unidade não é uma central de regulação.';
  END IF;
  IF NOT (private.tenho_papel(p_central, 'regulador') OR private.tenho_papel(p_central, 'gestor')) THEN
    RAISE EXCEPTION 'Os prazos são ajustados pelo regulador ou pelo gestor da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  FOREACH k IN ARRAY ARRAY['emergencia', 'urgencia', 'prioritaria', 'eletiva'] LOOP
    IF d->'fila' ? k AND jsonb_typeof(d->'fila'->k) NOT IN ('null', 'number') THEN
      RAISE EXCEPTION 'Prazo da fila em minutos.';
    END IF;
    IF (d->'fila'->>k)::numeric IS NOT NULL AND ((d->'fila'->>k)::numeric <> floor((d->'fila'->>k)::numeric)
        OR (d->'fila'->>k)::numeric NOT BETWEEN 1 AND 43200) THEN
      RAISE EXCEPTION 'Prazo da fila: de 1 minuto a 30 dias.';
    END IF;
    v_min := v_min || (d->'fila'->>k)::integer;
  END LOOP;
  v_evol := coalesce((d->>'evolucao_h')::integer, 12);
  v_pend := coalesce((d->>'pendencia_h')::integer, 3);
  v_sem  := coalesce((d->>'sem_evolucao_h')::integer, 72);
  v_dest := coalesce((d->>'destino_h')::integer, 24);
  IF v_evol NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Evolução: de 1 a 168 horas.'; END IF;
  IF v_pend NOT BETWEEN 1 AND 72 THEN RAISE EXCEPTION 'Resposta à pendência: de 1 a 72 horas.'; END IF;
  IF v_sem NOT BETWEEN 2 AND 720 OR v_sem <= v_evol THEN
    RAISE EXCEPTION 'Sem evolução: até 720 horas e maior que o prazo da evolução.';
  END IF;
  IF v_dest NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Resposta do destino: de 1 a 168 horas.'; END IF;
  v_antes := private.regulacao_prazos_json(p_central);
  INSERT INTO public.regulacao_prazos (central_id, fila_emergencia_min, fila_urgencia_min, fila_prioritaria_min, fila_eletiva_min,
    evolucao_h, pendencia_h, sem_evolucao_h, destino_h, atualizado_por, atualizado_em)
  VALUES (p_central, v_min[1], v_min[2], v_min[3], v_min[4], v_evol, v_pend, v_sem, v_dest, private.meu_perfil_id(), now())
  ON CONFLICT (central_id) DO UPDATE SET
    fila_emergencia_min = excluded.fila_emergencia_min, fila_urgencia_min = excluded.fila_urgencia_min,
    fila_prioritaria_min = excluded.fila_prioritaria_min, fila_eletiva_min = excluded.fila_eletiva_min,
    evolucao_h = excluded.evolucao_h, pendencia_h = excluded.pendencia_h, sem_evolucao_h = excluded.sem_evolucao_h,
    destino_h = excluded.destino_h, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  INSERT INTO public.regulacao_prazos_historico (central_id, antes, depois, por)
  VALUES (p_central, v_antes - 'atualizado_por' - 'atualizado_em',
          private.regulacao_prazos_json(p_central) - 'atualizado_por' - 'atualizado_em', private.meu_perfil_id())
  RETURNING id INTO v_hist;
  PERFORM private.registrar_auditoria('regulacao_prazos_ajustados', 'regulacao_prazos_historico', v_hist, p_central, NULL);
  RETURN private.regulacao_prazos_json(p_central);
END $$;

-- relógios: a espera pelo destino entra; a evolução corre também nela
CREATE OR REPLACE FUNCTION private.regulacao_sla(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.regulacao_prazos;
  v_ef text := coalesce(s.prioridade_regulador, s.prioridade);
  v_central_seg bigint;
  v_prazo integer;
  v_correndo boolean := s.status IN ('enviada', 'em_analise');
  v_fila_atrasada boolean;
  v_desde timestamptz;
  v_ultima timestamptz;
  v_pend jsonb;
  v_evol jsonb;
  v_dest jsonb;
BEGIN
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') THEN RETURN NULL; END IF;
  p := private.regulacao_prazos_de(s.central_id);
  SELECT coalesce(sum(extract(epoch FROM coalesce(t.fim, now()) - t.inicio)), 0)::bigint INTO v_central_seg
    FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id AND t.status IN ('enviada', 'em_analise');
  v_prazo := CASE v_ef WHEN 'emergencia' THEN p.fila_emergencia_min WHEN 'urgencia' THEN p.fila_urgencia_min
                       WHEN 'prioritaria' THEN p.fila_prioritaria_min WHEN 'eletiva' THEN p.fila_eletiva_min END;
  v_fila_atrasada := v_prazo IS NOT NULL AND v_central_seg > v_prazo * 60;
  SELECT t.inicio INTO v_desde FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id AND t.fim IS NULL;

  IF s.status IN ('pendencia', 'devolvida') THEN
    v_desde := coalesce(v_desde, CASE s.status WHEN 'pendencia' THEN s.pendencia_em ELSE s.devolvida_em END, s.criada_em);
    v_pend := jsonb_build_object('desde', v_desde, 'prazo_h', p.pendencia_h,
      'vence_em', v_desde + make_interval(hours => p.pendencia_h),
      'atrasada', now() > v_desde + make_interval(hours => p.pendencia_h));
  END IF;

  IF s.status = 'aguardando_destino' THEN
    v_desde := coalesce(v_desde, s.destino_enviado_em, s.autorizada_em, s.criada_em);
    v_dest := jsonb_build_object('desde', v_desde, 'prazo_h', p.destino_h,
      'vence_em', v_desde + make_interval(hours => p.destino_h),
      'atrasado', now() > v_desde + make_interval(hours => p.destino_h));
  END IF;

  IF s.tipo IN ('leito', 'transferencia') THEN
    v_ultima := greatest(s.criada_em, s.reenviada_em,
      (SELECT max(e.em) FROM public.regulacao_evolucoes e WHERE e.solicitacao_id = s.id));
    v_evol := jsonb_build_object('ultima_em', v_ultima, 'prazo_h', p.evolucao_h,
      'vence_em', v_ultima + make_interval(hours => p.evolucao_h),
      'atrasada', now() > v_ultima + make_interval(hours => p.evolucao_h),
      'limite_h', p.sem_evolucao_h,
      'risco_cancelamento', now() > v_ultima + make_interval(hours => p.sem_evolucao_h));
  END IF;

  RETURN jsonb_build_object(
    'fila', jsonb_build_object('prazo_min', v_prazo, 'central_seg', v_central_seg, 'correndo', v_correndo, 'atrasado', v_fila_atrasada),
    'pendencia', v_pend, 'evolucao', v_evol, 'destino', v_dest,
    'atrasado_central', v_correndo AND v_fila_atrasada,
    'atrasado_origem', coalesce((v_pend->>'atrasada')::boolean, false) OR coalesce((v_evol->>'atrasada')::boolean, false),
    'atrasado_destino', coalesce((v_dest->>'atrasado')::boolean, false));
END $$;

-- ── JSON do pedido com o destino ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_json(s public.regulacao_solicitacoes)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'numero', s.numero, 'status', s.status, 'tipo', s.tipo,
    'carater', s.carater, 'modalidade', s.modalidade, 'prioridade', s.prioridade,
    'prioridade_central', s.prioridade_central, 'prioridade_central_em', s.prioridade_central_em,
    'procedimento', s.procedimento,
    'procedimento_nome', (SELECT p.nome FROM terminologia.sigtap_procedimento p WHERE p.codigo = s.procedimento),
    'especialidade', s.especialidade, 'cbo', s.cbo,
    'tipo_leito', s.tipo_leito, 'internacao_psiquiatrica', s.internacao_psiquiatrica,
    'isolamento', s.isolamento, 'isolamento_tipo', s.isolamento_tipo,
    'transporte', s.transporte, 'transporte_central', s.transporte_central, 'incubadora', s.incubadora,
    'destino_tipo', s.destino_tipo,
    'destino_unidade', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.destino_unidade_id),
    'destino_externo', s.destino_externo,
    'cid', s.cid, 'cid_descricao', (SELECT c.descricao FROM terminologia.cid10 c WHERE c.codigo = s.cid),
    'quadro_clinico', s.quadro_clinico, 'tempo_evolucao', s.tempo_evolucao, 'sinais_vitais', s.sinais_vitais,
    'exames', s.exames, 'medicacoes', s.medicacoes, 'hipotese', s.hipotese, 'telefone_contato', s.telefone_contato,
    'paciente', (SELECT jsonb_build_object('id', pa.id, 'nome', coalesce(pa.nome_social, pa.nome), 'nascimento', pa.data_nascimento,
                                           'sexo', pa.sexo, 'cns', pa.cns) FROM public.pacientes pa WHERE pa.id = s.paciente_id),
    'paciente_nao_identificado', s.paciente_nao_identificado,
    'episodio_id', s.episodio_id, 'internacao_id', s.internacao_id,
    'origem', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.unidade_origem_id),
    'cnes_solicitante', s.cnes_solicitante,
    'central', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.central_id),
    'solicitante', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.solicitante_id),
    'solicitante_papel', s.solicitante_papel,
    'medico_assistente', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.medico_assistente_id),
    'externo_sistema', s.externo_sistema, 'externo_protocolo', s.externo_protocolo,
    'criada_em', s.criada_em, 'cancelada_em', s.cancelada_em, 'cancelamento_origem', s.cancelamento_origem,
    'motivo_cancelamento', s.motivo_cancelamento)
  -- jsonb_build_object aceita até 100 argumentos: a priorização vai num segundo objeto
  || jsonb_build_object(
    'prioridade_regulador', s.prioridade_regulador, 'prioridade_regulador_em', s.prioridade_regulador_em,
    'prioridade_regulador_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.prioridade_regulador_por),
    'prioridade_regulador_motivo', s.prioridade_regulador_motivo,
    'prioridade_efetiva', coalesce(s.prioridade_regulador, s.prioridade),
    'vulnerabilidades', to_jsonb(s.vulnerabilidades))
  -- decisão da central e respostas da origem (tarefa 4)
  || jsonb_build_object(
    'autorizada_em', s.autorizada_em,
    'autorizada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.autorizada_por),
    'data_prevista', s.data_prevista, 'observacao_decisao', s.observacao_decisao,
    'negada_em', s.negada_em, 'negada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.negada_por),
    'motivo_negacao', s.motivo_negacao,
    'devolvida_em', s.devolvida_em, 'devolvida_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.devolvida_por),
    'motivo_devolucao', s.motivo_devolucao, 'reenviada_em', s.reenviada_em,
    'pendencia_pergunta', s.pendencia_pergunta, 'pendencia_em', s.pendencia_em,
    'pendencia_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.pendencia_por),
    'pendencia_resposta', s.pendencia_resposta, 'pendencia_respondida_em', s.pendencia_respondida_em,
    'pendencia_respondida_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.pendencia_respondida_por),
    'origem_pode_responder', private.regulacao_origem_pode(s))
  -- relógios (tarefa 7)
  || jsonb_build_object('sla', private.regulacao_sla(s))
  -- destino e chegada (tarefa 9)
  || jsonb_build_object(
    'destino_enviado_em', s.destino_enviado_em, 'destino_resposta', s.destino_resposta,
    'destino_respondido_em', s.destino_respondido_em,
    'destino_respondido_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.destino_respondido_por),
    'reserva', (SELECT jsonb_build_object('leito', l.identificador, 'setor', st.nome, 'situacao', r.situacao, 'expira_em', r.expira_em)
                  FROM public.reservas_leito r JOIN public.leitos l ON l.id = r.leito_id JOIN public.setores st ON st.id = l.setor_id
                 WHERE r.id = s.reserva_id),
    'saida_em', s.saida_em, 'saida_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.saida_por),
    'realizada_em', s.realizada_em, 'falta_em', s.falta_em, 'chegada_observacao', s.chegada_observacao,
    'chegada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = s.chegada_por),
    'ultima_recusa', (SELECT jsonb_build_object('em', r.em, 'motivo', r.motivo, 'texto', r.texto, 'registro', r.por_registro,
                         'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = r.por),
                         'destino', coalesce((SELECT u.nome FROM public.unidades u WHERE u.id = r.destino_unidade_id), r.destino_externo),
                         'externo_quem', r.externo_quem, 'externo_meio', r.externo_meio)
                        FROM public.regulacao_destino_respostas r
                       WHERE r.solicitacao_id = s.id AND r.resposta = 'recusada' ORDER BY r.em DESC LIMIT 1),
    'ultimo_aceite', (SELECT jsonb_build_object('em', r.em, 'texto', r.texto, 'registro', r.por_registro,
                         'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = r.por),
                         'externo_quem', r.externo_quem, 'externo_meio', r.externo_meio)
                        FROM public.regulacao_destino_respostas r
                       WHERE r.solicitacao_id = s.id AND r.resposta = 'aceita' ORDER BY r.em DESC LIMIT 1),
    'sou_destino', private.regulacao_sou_destino(s))
$$;

-- ── a central autoriza: o pedido vai ao destino ─────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_autorizar(p_id uuid, p_destino_tipo text, p_destino_unidade_id uuid DEFAULT NULL,
  p_destino_externo text DEFAULT NULL, p_transporte text DEFAULT NULL, p_data_prevista timestamptz DEFAULT NULL, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_destino text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  PERFORM private.regulacao_regulador_decide(s);
  IF p_destino_tipo = 'rede' THEN
    IF NOT EXISTS (SELECT 1 FROM public.unidades x WHERE x.id = p_destino_unidade_id AND x.ativo
                     AND x.organizacao_id = s.organizacao_id AND x.id <> s.central_id) THEN
      RAISE EXCEPTION 'O destino precisa ser uma unidade ativa da rede.';
    END IF;
    IF p_destino_unidade_id = s.unidade_origem_id THEN RAISE EXCEPTION 'O destino não pode ser a unidade de origem.'; END IF;
    v_destino := (SELECT nome FROM public.unidades WHERE id = p_destino_unidade_id);
  ELSIF p_destino_tipo = 'externo' THEN
    IF length(btrim(coalesce(p_destino_externo, ''))) < 3 THEN RAISE EXCEPTION 'Informe o serviço de destino.'; END IF;
    v_destino := btrim(p_destino_externo);
  ELSE
    RAISE EXCEPTION 'Para autorizar, defina o destino: unidade da rede ou serviço de fora.';
  END IF;
  IF p_transporte IS NOT NULL AND p_transporte NOT IN ('transporte_sanitario', 'ambulancia_basica', 'ambulancia_avancada',
                                                       'aereo', 'embarcacao', 'meios_proprios') THEN
    RAISE EXCEPTION 'Transporte inválido.';
  END IF;
  UPDATE public.regulacao_solicitacoes
     SET status = 'aguardando_destino', autorizada_em = now(), autorizada_por = private.meu_perfil_id(),
         destino_tipo = p_destino_tipo,
         destino_unidade_id = CASE WHEN p_destino_tipo = 'rede' THEN p_destino_unidade_id END,
         destino_externo = CASE WHEN p_destino_tipo = 'externo' THEN btrim(p_destino_externo) END,
         transporte_central = coalesce(p_transporte, transporte_central),
         data_prevista = p_data_prevista,
         observacao_decisao = nullif(btrim(coalesce(p_observacao, '')), ''),
         assumida_por = coalesce(assumida_por, private.meu_perfil_id()),
         destino_enviado_em = now(), destino_resposta = NULL, destino_respondido_em = NULL, destino_respondido_por = NULL
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'autorizada', jsonb_build_object('destino', v_destino, 'transporte', p_transporte,
    'data_prevista', p_data_prevista, 'observacao', nullif(btrim(coalesce(p_observacao, '')), '')));
  PERFORM private.registrar_auditoria('regulacao_autorizada', 'regulacao_solicitacoes', s.id, s.central_id,
    jsonb_build_object('destino', v_destino));
  PERFORM private.regulacao_avisar(s, 'reg_autorizada',
    'Regulação nº ' || s.numero || ' autorizada pela central para ' || v_destino || '; aguardando o aceite do destino.');
  PERFORM private.regulacao_avisar_destino(s, 'reg_destino',
    'Regulação nº ' || s.numero || ': pedido de ' || CASE s.tipo WHEN 'leito' THEN 'leito' WHEN 'transferencia' THEN 'transferência'
      WHEN 'exame' THEN 'exame' ELSE 'consulta' END || ' aguardando o aceite da unidade.');
  RETURN private.regulacao_json_fila(s);
END $$;

-- ── o destino responde ──────────────────────────────────────────────────────
-- Leitos livres do destino, os do tipo pedido primeiro.
CREATE OR REPLACE FUNCTION public.regulacao_leitos_destino(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id;
  IF NOT FOUND OR NOT private.regulacao_sou_destino(s) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'leito', l.identificador, 'setor', st.nome,
           'tipo_regulacao', st.regulacao_tipo_leito, 'do_tipo', st.regulacao_tipo_leito IS NOT DISTINCT FROM s.tipo_leito AND s.tipo_leito IS NOT NULL)
           ORDER BY (st.regulacao_tipo_leito IS NOT DISTINCT FROM s.tipo_leito AND s.tipo_leito IS NOT NULL) DESC,
                    (st.regulacao_tipo_leito IS NOT NULL) DESC, st.ordem, st.nome, l.identificador)
      FROM public.leitos l JOIN public.setores st ON st.id = l.setor_id
     WHERE st.unidade_id = s.destino_unidade_id AND st.ativo AND l.ativo AND l.status = 'livre'), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_leitos_destino(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_leitos_destino(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_meu_registro()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p.crm IS NOT NULL THEN 'CRM ' || p.crm || coalesce('/' || p.uf_crm, '') END
    FROM public.perfis p WHERE p.id = private.meu_perfil_id()
$$;
REVOKE ALL ON FUNCTION private.regulacao_meu_registro() FROM PUBLIC, anon, authenticated;

-- Aceite. Pedido de leito: escolher um leito livre do destino, que fica reservado.
CREATE OR REPLACE FUNCTION public.regulacao_destino_aceitar(p_id uuid, p_leito uuid DEFAULT NULL, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  v_reserva uuid;
  v_ident text;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF s.status <> 'aguardando_destino' OR s.destino_tipo <> 'rede' THEN RAISE EXCEPTION 'Este pedido não está aguardando o aceite da unidade.'; END IF;
  IF NOT private.regulacao_sou_destino(s) THEN
    RAISE EXCEPTION 'Responde pelo destino o médico plantonista ou o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.tipo = 'leito' AND p_leito IS NULL THEN RAISE EXCEPTION 'Escolha o leito que fica reservado para o paciente.'; END IF;
  IF p_leito IS NOT NULL THEN
    SELECT l.identificador INTO v_ident FROM public.leitos l JOIN public.setores st ON st.id = l.setor_id
     WHERE l.id = p_leito AND st.unidade_id = s.destino_unidade_id AND l.ativo AND st.ativo;
    IF v_ident IS NULL THEN RAISE EXCEPTION 'Leito não encontrado nesta unidade.'; END IF;
    PERFORM private.expirar_reservas();
    INSERT INTO public.reservas_leito (leito_id, unidade_id, paciente_id, motivo, reservado_por, expira_em)
    VALUES (p_leito, s.destino_unidade_id, NULL, 'Regulação nº ' || s.numero || ' (de ' || (SELECT nome FROM public.unidades WHERE id = s.unidade_origem_id) || ')',
            private.meu_perfil_id(), greatest(now() + interval '24 hours', coalesce(s.data_prevista, now()) + interval '8 hours'))
    RETURNING id INTO v_reserva;
    PERFORM set_config('cc.reserva_nova', p_leito::text, true);
    UPDATE public.leitos SET status = 'reservado' WHERE id = p_leito;   -- a trava recusa leito que não está livre
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
    VALUES (p_leito, s.destino_unidade_id, 'reserva', 'livre', 'reservado', private.meu_perfil_id(), 'Reserva: regulação nº ' || s.numero);
  END IF;
  INSERT INTO public.regulacao_destino_respostas (solicitacao_id, destino_tipo, destino_unidade_id, resposta, texto, leito_id, por, por_registro)
  VALUES (s.id, 'rede', s.destino_unidade_id, 'aceita', v_obs, p_leito, private.meu_perfil_id(), private.regulacao_meu_registro());
  UPDATE public.regulacao_solicitacoes
     SET status = 'autorizada', destino_resposta = 'aceita', destino_respondido_em = now(), destino_respondido_por = private.meu_perfil_id(),
         reserva_id = v_reserva
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'destino_aceitou', jsonb_build_object('leito', v_ident, 'observacao', v_obs,
    'registro', private.regulacao_meu_registro()));
  PERFORM private.registrar_auditoria('regulacao_destino_aceitou', 'regulacao_solicitacoes', s.id, s.destino_unidade_id, NULL);
  PERFORM private.regulacao_avisar(s, 'reg_destino_aceitou',
    'Regulação nº ' || s.numero || ': o destino aceitou' || CASE WHEN v_ident IS NOT NULL THEN ' e reservou o leito ' || v_ident ELSE '' END || '.');
  PERFORM private.regulacao_avisar_regulador(s, 'reg_destino_aceitou',
    'Regulação nº ' || s.numero || ': o destino aceitou' || CASE WHEN v_ident IS NOT NULL THEN ' (leito ' || v_ident || ')' ELSE '' END || '.');
  RETURN private.regulacao_json(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_destino_aceitar(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_destino_aceitar(uuid, uuid, text) TO authenticated;

-- volta à fila da central para escolher outro destino
CREATE OR REPLACE FUNCTION private.regulacao_voltar_a_central(s public.regulacao_solicitacoes)
RETURNS public.regulacao_solicitacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.regulacao_solicitacoes;
BEGIN
  UPDATE public.regulacao_solicitacoes
     SET status = CASE WHEN assumida_por IS NOT NULL THEN 'em_analise' ELSE 'enviada' END,
         destino_resposta = 'recusada', destino_respondido_em = now(), destino_respondido_por = private.meu_perfil_id(),
         destino_tipo = 'a_definir', destino_unidade_id = NULL, destino_externo = NULL, data_prevista = NULL
   WHERE id = s.id RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_voltar_a_central(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_motivo_recusa_ok(p_motivo text, p_texto text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_motivo IS NULL OR p_motivo NOT IN ('sem_vaga', 'sem_recurso', 'perfil_incompativel', 'outro') THEN
    RAISE EXCEPTION 'Motivo: sem leito ou vaga, sem o recurso, perfil fora do serviço ou outro.';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a justificativa (mínimo de 10 letras).'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.regulacao_destino_recusar(p_id uuid, p_motivo text, p_texto text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_destino uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF s.status <> 'aguardando_destino' OR s.destino_tipo <> 'rede' THEN RAISE EXCEPTION 'Este pedido não está aguardando o aceite da unidade.'; END IF;
  IF NOT private.regulacao_sou_destino(s) THEN
    RAISE EXCEPTION 'Responde pelo destino o médico plantonista ou o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.regulacao_motivo_recusa_ok(p_motivo, p_texto);
  v_destino := s.destino_unidade_id;
  INSERT INTO public.regulacao_destino_respostas (solicitacao_id, destino_tipo, destino_unidade_id, resposta, motivo, texto, por, por_registro)
  VALUES (s.id, 'rede', v_destino, 'recusada', p_motivo, btrim(p_texto), private.meu_perfil_id(), private.regulacao_meu_registro());
  s := private.regulacao_voltar_a_central(s);
  PERFORM private.regulacao_evento(s.id, 'destino_recusou', jsonb_build_object('motivo', p_motivo, 'texto', btrim(p_texto),
    'destino', (SELECT nome FROM public.unidades WHERE id = v_destino), 'registro', private.regulacao_meu_registro()));
  PERFORM private.registrar_auditoria('regulacao_destino_recusou', 'regulacao_solicitacoes', s.id, v_destino,
    jsonb_build_object('motivo_codigo', p_motivo));
  PERFORM private.regulacao_avisar(s, 'reg_destino_recusou',
    'Regulação nº ' || s.numero || ': o destino recusou (' || btrim(p_texto) || '). A central vai escolher outro destino.');
  PERFORM private.regulacao_avisar_regulador(s, 'reg_destino_recusou',
    'Regulação nº ' || s.numero || ': o destino recusou — ' || btrim(p_texto) || '. O pedido voltou à fila.');
  RETURN private.regulacao_json(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_destino_recusar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_destino_recusar(uuid, text, text) TO authenticated;

-- Destino fora da rede: a central registra a resposta (quem confirmou e o meio).
CREATE OR REPLACE FUNCTION public.regulacao_registrar_resposta_externa(p_id uuid, p_aceita boolean, p_quem text, p_meio text,
  p_motivo text DEFAULT NULL, p_texto text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_destino text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT private.tenho_papel(s.central_id, 'regulador') THEN
    RAISE EXCEPTION 'Quem registra a resposta do serviço de fora é o regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status <> 'aguardando_destino' OR s.destino_tipo <> 'externo' THEN RAISE EXCEPTION 'Este pedido não está aguardando um serviço de fora da rede.'; END IF;
  IF length(btrim(coalesce(p_quem, ''))) < 3 THEN RAISE EXCEPTION 'Informe quem confirmou no serviço de destino.'; END IF;
  IF p_meio IS NULL OR p_meio NOT IN ('telefone', 'sistema_externo', 'presencial', 'outro') THEN
    RAISE EXCEPTION 'Meio: telefone, sistema externo, presencial ou outro.';
  END IF;
  IF NOT p_aceita THEN PERFORM private.regulacao_motivo_recusa_ok(p_motivo, p_texto); END IF;
  v_destino := s.destino_externo;
  INSERT INTO public.regulacao_destino_respostas (solicitacao_id, destino_tipo, destino_externo, resposta, motivo, texto, por,
    externo_quem, externo_meio)
  VALUES (s.id, 'externo', v_destino, CASE WHEN p_aceita THEN 'aceita' ELSE 'recusada' END,
          CASE WHEN p_aceita THEN NULL ELSE p_motivo END, nullif(btrim(coalesce(p_texto, '')), ''),
          private.meu_perfil_id(), btrim(p_quem), p_meio);
  IF p_aceita THEN
    UPDATE public.regulacao_solicitacoes
       SET status = 'autorizada', destino_resposta = 'aceita', destino_respondido_em = now(), destino_respondido_por = private.meu_perfil_id()
     WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_evento(s.id, 'destino_aceitou', jsonb_build_object('destino', v_destino, 'quem', btrim(p_quem), 'meio', p_meio));
    PERFORM private.regulacao_avisar(s, 'reg_destino_aceitou', 'Regulação nº ' || s.numero || ': ' || v_destino || ' aceitou o paciente.');
  ELSE
    s := private.regulacao_voltar_a_central(s);
    PERFORM private.regulacao_evento(s.id, 'destino_recusou', jsonb_build_object('destino', v_destino, 'quem', btrim(p_quem), 'meio', p_meio,
      'motivo', p_motivo, 'texto', btrim(p_texto)));
    PERFORM private.regulacao_avisar(s, 'reg_destino_recusou',
      'Regulação nº ' || s.numero || ': ' || v_destino || ' recusou (' || btrim(p_texto) || '). A central vai escolher outro destino.');
  END IF;
  PERFORM private.registrar_auditoria('regulacao_resposta_externa', 'regulacao_solicitacoes', s.id, s.central_id,
    jsonb_build_object('status', s.status));
  RETURN private.regulacao_json(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_registrar_resposta_externa(uuid, boolean, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_registrar_resposta_externa(uuid, boolean, text, text, text, text) TO authenticated;

-- ── chegada ─────────────────────────────────────────────────────────────────
-- A origem marca a saída do paciente.
CREATE OR REPLACE FUNCTION public.regulacao_marcar_saida(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT (private.regulacao_origem_pode(s) OR private.tenho_papel(s.unidade_origem_id, 'plantonista')) THEN
    RAISE EXCEPTION 'Marca a saída a equipe médica ou o gestor da origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('autorizada', 'agendada') THEN RAISE EXCEPTION 'Só sai o paciente com o pedido aceito pelo destino.'; END IF;
  UPDATE public.regulacao_solicitacoes SET status = 'em_transito', saida_em = now(), saida_por = private.meu_perfil_id()
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_estender_reserva(s, 8);
  PERFORM private.regulacao_evento(s.id, 'saiu', NULL);
  PERFORM private.regulacao_avisar_destino(s, 'reg_saiu', 'Regulação nº ' || s.numero || ': o paciente saiu da origem.');
  RETURN private.regulacao_json(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_marcar_saida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_marcar_saida(uuid) TO authenticated;

-- O destino marca "chegou" (realizada) ou "não chegou" (falta). Destino de fora: a central.
CREATE OR REPLACE FUNCTION public.regulacao_marcar_chegada(p_id uuid, p_chegou boolean, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT ((s.destino_tipo = 'rede' AND private.regulacao_sou_destino(s))
          OR (s.destino_tipo = 'externo' AND private.tenho_papel(s.central_id, 'regulador'))) THEN
    RAISE EXCEPTION 'Marca a chegada a unidade destino (ou a central, se o destino é de fora da rede).' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('autorizada', 'agendada', 'em_transito') THEN RAISE EXCEPTION 'Este pedido não está esperando a chegada do paciente.'; END IF;
  IF NOT p_chegou AND length(coalesce(v_obs, '')) < 10 THEN RAISE EXCEPTION 'Escreva o que aconteceu (mínimo de 10 letras).'; END IF;
  IF p_chegou THEN
    UPDATE public.regulacao_solicitacoes SET status = 'realizada', realizada_em = now(), chegada_por = private.meu_perfil_id(),
           chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_estender_reserva(s, 8);   -- pronta para ocupar o leito
    PERFORM private.regulacao_evento(s.id, 'chegou', jsonb_build_object('observacao', v_obs));
  ELSE
    UPDATE public.regulacao_solicitacoes SET status = 'falta', falta_em = now(), chegada_por = private.meu_perfil_id(),
           chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_liberar_reserva(s, 'Regulação nº ' || s.numero || ': paciente não chegou');
    PERFORM private.regulacao_evento(s.id, 'nao_chegou', jsonb_build_object('observacao', v_obs));
    PERFORM private.regulacao_avisar(s, 'reg_nao_chegou', 'Regulação nº ' || s.numero || ': o destino registrou que o paciente não chegou — ' || v_obs);
  END IF;
  PERFORM private.registrar_auditoria('regulacao_chegada', 'regulacao_solicitacoes', s.id, coalesce(s.destino_unidade_id, s.central_id),
    jsonb_build_object('status', s.status));
  RETURN private.regulacao_json(s);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_marcar_chegada(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_marcar_chegada(uuid, boolean, text) TO authenticated;

-- ── cancelar: também esperando o destino ou a chegada ───────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_cancelar(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_tinha_destino boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT (s.solicitante_id = private.meu_perfil_id() OR private.tenho_papel(s.unidade_origem_id, 'gestor')) THEN
    RAISE EXCEPTION 'Cancela quem solicitou ou o gestor da unidade de origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada') THEN
    RAISE EXCEPTION 'Esta solicitação não pode mais ser cancelada.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  v_tinha_destino := s.status IN ('aguardando_destino', 'autorizada', 'agendada');
  UPDATE public.regulacao_solicitacoes SET status = 'cancelada', cancelada_em = now(), cancelada_por = private.meu_perfil_id(),
         cancelamento_origem = 'solicitante', motivo_cancelamento = btrim(p_motivo) WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_liberar_reserva(s, 'Regulação nº ' || s.numero || ' cancelada pela origem');
  PERFORM private.regulacao_evento(s.id, 'cancelada', jsonb_build_object('motivo', btrim(p_motivo)));
  PERFORM private.registrar_auditoria('regulacao_cancelada', 'regulacao_solicitacoes', s.id, s.unidade_origem_id,
    jsonb_build_object('motivo', btrim(p_motivo)));
  IF v_tinha_destino THEN
    PERFORM private.regulacao_avisar_destino(s, 'reg_cancelada', 'Regulação nº ' || s.numero || ' cancelada pela origem: ' || btrim(p_motivo));
    PERFORM private.regulacao_avisar_regulador(s, 'reg_cancelada', 'Regulação nº ' || s.numero || ' cancelada pela origem: ' || btrim(p_motivo));
  END IF;
END $$;

-- ── pedidos recebidos pela unidade destino ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_destino_lista(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(private.regulacao_json(s)
           ORDER BY (s.status = 'aguardando_destino') DESC, (s.status IN ('autorizada', 'agendada', 'em_transito')) DESC,
                    coalesce(s.destino_enviado_em, s.autorizada_em, s.criada_em) DESC)
    FROM (SELECT * FROM public.regulacao_solicitacoes
           WHERE destino_unidade_id = p_unidade
             AND status IN ('aguardando_destino', 'autorizada', 'agendada', 'em_transito', 'realizada', 'falta')
           ORDER BY coalesce(destino_enviado_em, autorizada_em, criada_em) DESC LIMIT 200) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_destino_lista(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_destino_lista(uuid) TO authenticated;

-- ── evolução também enquanto espera o destino ───────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_atualizar_evolucao(p_id uuid, p_texto text, p_sinais_vitais text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT private.regulacao_origem_pode(s) THEN
    RAISE EXCEPTION 'Atualizam a evolução o solicitante, o médico assistente e o gestor da origem.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') THEN
    RAISE EXCEPTION 'Só se atualiza a evolução com o pedido esperando decisão.';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a evolução (mínimo de 10 letras).'; END IF;
  INSERT INTO public.regulacao_evolucoes (solicitacao_id, texto, sinais_vitais, autor_id)
  VALUES (s.id, btrim(p_texto), nullif(btrim(coalesce(p_sinais_vitais, '')), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.regulacao_evento(s.id, 'evolucao_atualizada',
    jsonb_build_object('texto', btrim(p_texto), 'sinais_vitais', nullif(btrim(coalesce(p_sinais_vitais, '')), '')));
  IF s.assumida_por IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (s.assumida_por, s.central_id, current_date, 'reg_evolucao_' || s.numero,
            'Regulação nº ' || s.numero || ': a origem atualizou a evolução do paciente.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
      SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  END IF;
  IF s.status = 'aguardando_destino' THEN
    PERFORM private.regulacao_avisar_destino(s, 'reg_evolucao', 'Regulação nº ' || s.numero || ': a origem atualizou a evolução do paciente.');
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.regulacao_detalhe(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id;
  IF NOT FOUND OR NOT private.regulacao_pode_ver(s) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  RETURN private.regulacao_json(s) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'evento', e.evento, 'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = e.por), 'em', e.em, 'detalhes', e.detalhes)
        ORDER BY e.em) FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id), '[]'::jsonb),
    'tempos', coalesce((SELECT jsonb_agg(jsonb_build_object('status', x.status, 'segundos', x.seg, 'vezes', x.vezes, 'atual', x.atual)
        ORDER BY x.primeiro) FROM (
          SELECT t.status, min(t.inicio) AS primeiro, count(*) AS vezes, bool_or(t.fim IS NULL) AS atual,
                 sum(extract(epoch FROM coalesce(t.fim, now()) - t.inicio))::bigint AS seg
            FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id GROUP BY t.status) x), '[]'::jsonb),
    'evolucoes', coalesce((SELECT jsonb_agg(jsonb_build_object('texto', e.texto, 'sinais_vitais', e.sinais_vitais, 'em', e.em,
        'autor', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = e.autor_id)) ORDER BY e.em DESC)
        FROM public.regulacao_evolucoes e WHERE e.solicitacao_id = s.id), '[]'::jsonb),
    'pode_evoluir', private.regulacao_origem_pode(s) AND s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino'));
END $$;

-- ── painel e avisos de prazo com o destino ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_sla_painel(p_unidade uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_central boolean;
  v_so_atrasados boolean := coalesce((f->>'so_atrasados')::boolean, false);
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_central := EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_unidade);
  IF v_central THEN
    IF NOT (private.eh_super_admin() OR private.tenho_papel(p_unidade, 'regulador') OR private.tenho_papel(p_unidade, 'gestor')) THEN
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN (
    WITH base AS (
      SELECT s, private.regulacao_sla(s) AS sla
        FROM public.regulacao_solicitacoes s
       WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino')
         AND ((v_central AND s.central_id = p_unidade) OR (NOT v_central AND s.unidade_origem_id = p_unidade))
    ), filtrada AS (
      SELECT b.* FROM base b
       WHERE (NOT f ? 'tipo' OR (b.s).tipo = f->>'tipo')
         AND (NOT f ? 'prioridade' OR coalesce((b.s).prioridade_regulador, (b.s).prioridade) = f->>'prioridade')
         AND (NOT v_so_atrasados OR (b.sla->>'atrasado_central')::boolean OR (b.sla->>'atrasado_origem')::boolean
              OR (b.sla->>'atrasado_destino')::boolean)
    )
    SELECT jsonb_build_object(
      'central', v_central,
      'dados', coalesce((SELECT jsonb_agg(private.regulacao_json_fila(x.s) ORDER BY
                 CASE WHEN v_central THEN (x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_destino')::boolean
                      ELSE (x.sla->>'atrasado_origem')::boolean END DESC,
                 ((x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_origem')::boolean OR (x.sla->>'atrasado_destino')::boolean) DESC,
                 CASE coalesce((x.s).prioridade_regulador, (x.s).prioridade)
                   WHEN 'emergencia' THEN 1 WHEN 'urgencia' THEN 2 WHEN 'prioritaria' THEN 3 WHEN 'eletiva' THEN 4 ELSE 5 END,
                 (x.s).criada_em)
          FROM (SELECT * FROM filtrada LIMIT 500) x), '[]'::jsonb),
      'resumo', (SELECT jsonb_build_object(
          'abertos', count(*),
          'fila_atrasada', count(*) FILTER (WHERE (b.sla->>'atrasado_central')::boolean),
          'fila_sem_prazo', count(*) FILTER (WHERE b.sla->'fila'->'prazo_min' = 'null'::jsonb),
          'pendencia_atrasada', count(*) FILTER (WHERE (b.sla->'pendencia'->>'atrasada')::boolean),
          'evolucao_atrasada', count(*) FILTER (WHERE (b.sla->'evolucao'->>'atrasada')::boolean),
          'risco_cancelamento', count(*) FILTER (WHERE (b.sla->'evolucao'->>'risco_cancelamento')::boolean),
          'destino_atrasado', count(*) FILTER (WHERE (b.sla->>'atrasado_destino')::boolean))
        FROM base b),
      'prazos', private.regulacao_prazos_json(CASE WHEN v_central THEN p_unidade
                  ELSE (SELECT c.unidade_id FROM public.centrais_regulacao c JOIN public.unidades u ON u.organizacao_id = c.organizacao_id
                         WHERE u.id = p_unidade) END),
      'agora', now()));
END $$;

CREATE OR REPLACE FUNCTION private.regulacao_sla_avisar()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  v jsonb;
  n integer := 0;
  k integer;
BEGIN
  FOR s IN SELECT * FROM public.regulacao_solicitacoes WHERE status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino') LOOP
    v := private.regulacao_sla(s);
    -- origem: solicitante e médico assistente
    IF (v->'pendencia'->>'atrasada')::boolean THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT DISTINCT q, s.unidade_origem_id, current_date, 'reg_prazo_pendencia_' || s.numero,
             'Regulação nº ' || s.numero || ': ' || CASE s.status WHEN 'pendencia' THEN 'a pergunta da central' ELSE 'o pedido devolvido' END
             || ' espera resposta há mais de ' || (v->'pendencia'->>'prazo_h') || ' h.'
        FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]) q WHERE q IS NOT NULL
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;
    IF (v->'evolucao'->>'atrasada')::boolean THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT DISTINCT q, s.unidade_origem_id, current_date,
             CASE WHEN (v->'evolucao'->>'risco_cancelamento')::boolean THEN 'reg_prazo_72h_' ELSE 'reg_prazo_evolucao_' END || s.numero,
             'Regulação nº ' || s.numero || ': ' || CASE WHEN (v->'evolucao'->>'risco_cancelamento')::boolean
               THEN (v->'evolucao'->>'limite_h') || ' h sem evolução; a central pode cancelar o pedido. Atualize a evolução.'
               ELSE 'a evolução do paciente passou de ' || (v->'evolucao'->>'prazo_h') || ' h. Atualize no pedido.' END
        FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]) q WHERE q IS NOT NULL
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;
    -- central: quem está com o pedido ou, se ninguém, os reguladores da central
    IF (v->>'atrasado_central')::boolean OR (v->>'atrasado_destino')::boolean THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT DISTINCT q, s.central_id, current_date,
             CASE WHEN (v->>'atrasado_destino')::boolean THEN 'reg_prazo_destino_' ELSE 'reg_prazo_fila_' END || s.numero,
             'Regulação nº ' || s.numero || ': ' || CASE WHEN (v->>'atrasado_destino')::boolean
               THEN 'o destino não respondeu em ' || (v->'destino'->>'prazo_h') || ' h.'
               ELSE 'passou do prazo da fila (' || (v->'fila'->>'prazo_min') || ' min) sem decisão.' END
        FROM (SELECT s.assumida_por AS q WHERE s.assumida_por IS NOT NULL
              UNION
              SELECT vi.perfil_id FROM public.vinculos vi
               WHERE s.assumida_por IS NULL AND vi.unidade_id = s.central_id AND vi.papel = 'regulador' AND vi.ativo) r
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;
    -- destino: médicos e gestor
    IF (v->>'atrasado_destino')::boolean AND s.destino_unidade_id IS NOT NULL THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT DISTINCT vi.perfil_id, s.destino_unidade_id, current_date, 'reg_prazo_destino_' || s.numero,
             'Regulação nº ' || s.numero || ': o pedido espera o aceite da unidade há mais de ' || (v->'destino'->>'prazo_h') || ' h.'
        FROM public.vinculos vi
       WHERE vi.unidade_id = s.destino_unidade_id AND vi.ativo AND vi.papel IN ('plantonista', 'gestor')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;
  END LOOP;
  RETURN n;
END $$;
