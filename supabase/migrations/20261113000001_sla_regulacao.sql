-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 7 — painel de SLA da regulação (decisões do RT de
-- 11/10/2026, BACKLOG.md).
--
-- • Relógios da origem, só como alerta e sem ação automática (Nota Técnica
--   SES-MG 15/2008; Deliberação CIB-SP 35/2022):
--   - evolução do pedido a cada 12 h e 72 h sem evolução, em leito e
--     transferência;
--   - resposta à pendência (ou ao pedido devolvido) em 3 h, em todos os tipos.
-- • Prazo da fila por prioridade: cada central cadastra; começa vazio. Conta só
--   o tempo com a central (enviada, em análise); com a origem, pausa.
-- • A central ajusta os valores para a rede (auditado).
-- • "Atualizar evolução": ação nova da origem; recomeça o relógio de 12/72 h.
-- • Tempo em cada status, guardado a cada troca.
-- • Alerta: selo na fila e no painel; aviso (uma vez por dia e por relógio) na
--   categoria Regulação, por um job a cada 15 min.
-- ════════════════════════════════════════════════════════════════════════════

-- ── prazos da central ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_prazos (
  central_id            uuid PRIMARY KEY REFERENCES public.unidades(id),
  fila_emergencia_min   integer CHECK (fila_emergencia_min BETWEEN 1 AND 43200),
  fila_urgencia_min     integer CHECK (fila_urgencia_min BETWEEN 1 AND 43200),
  fila_prioritaria_min  integer CHECK (fila_prioritaria_min BETWEEN 1 AND 43200),
  fila_eletiva_min      integer CHECK (fila_eletiva_min BETWEEN 1 AND 43200),
  evolucao_h            integer NOT NULL DEFAULT 12 CHECK (evolucao_h BETWEEN 1 AND 168),
  pendencia_h           integer NOT NULL DEFAULT 3 CHECK (pendencia_h BETWEEN 1 AND 72),
  sem_evolucao_h        integer NOT NULL DEFAULT 72 CHECK (sem_evolucao_h BETWEEN 2 AND 720),
  atualizado_por        uuid REFERENCES public.perfis(id),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  CHECK (sem_evolucao_h > evolucao_h)
);
ALTER TABLE public.regulacao_prazos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_prazos FROM anon, authenticated;

-- cada ajuste, com o antes e o depois (o log de auditoria guarda só campos simples)
CREATE TABLE IF NOT EXISTS public.regulacao_prazos_historico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  central_id  uuid NOT NULL REFERENCES public.unidades(id),
  antes       jsonb NOT NULL,
  depois      jsonb NOT NULL,
  por         uuid NOT NULL REFERENCES public.perfis(id),
  em          timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_regulacao_prazos_historico_so_insercao ON public.regulacao_prazos_historico;
CREATE TRIGGER trg_regulacao_prazos_historico_so_insercao BEFORE UPDATE OR DELETE ON public.regulacao_prazos_historico
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.regulacao_prazos_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_prazos_historico FROM anon, authenticated;

-- ── tempo em cada status ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_status_tempos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  status          text NOT NULL,
  inicio          timestamptz NOT NULL,
  fim             timestamptz,
  CHECK (fim IS NULL OR fim >= inicio)
);
CREATE INDEX IF NOT EXISTS idx_regulacao_status_tempos ON public.regulacao_status_tempos (solicitacao_id, inicio);
CREATE UNIQUE INDEX IF NOT EXISTS uq_regulacao_status_aberto ON public.regulacao_status_tempos (solicitacao_id) WHERE fim IS NULL;
ALTER TABLE public.regulacao_status_tempos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_status_tempos FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_status_trocado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    UPDATE public.regulacao_status_tempos SET fim = greatest(now(), inicio)
     WHERE solicitacao_id = NEW.id AND fim IS NULL;
  END IF;
  INSERT INTO public.regulacao_status_tempos (solicitacao_id, status, inicio)
  VALUES (NEW.id, NEW.status, CASE WHEN TG_OP = 'INSERT' THEN NEW.criada_em ELSE now() END);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_status_trocado() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_regulacao_status_tempos ON public.regulacao_solicitacoes;
CREATE TRIGGER trg_regulacao_status_tempos AFTER INSERT OR UPDATE OF status ON public.regulacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION private.regulacao_status_trocado();

-- Pedidos anteriores: tempo aproximado pelas datas que o pedido já guarda
-- (com a central desde o envio até o status atual).
INSERT INTO public.regulacao_status_tempos (solicitacao_id, status, inicio, fim)
SELECT s.id, 'enviada', s.criada_em, greatest(x.desde, s.criada_em)
  FROM public.regulacao_solicitacoes s
  CROSS JOIN LATERAL (SELECT coalesce(CASE s.status
         WHEN 'pendencia' THEN s.pendencia_em WHEN 'devolvida' THEN s.devolvida_em
         WHEN 'autorizada' THEN s.autorizada_em WHEN 'negada' THEN s.negada_em
         WHEN 'cancelada' THEN s.cancelada_em WHEN 'realizada' THEN s.realizada_em END, s.criada_em) AS desde) x
 WHERE s.status NOT IN ('enviada', 'em_analise', 'rascunho')
   AND NOT EXISTS (SELECT 1 FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id);
INSERT INTO public.regulacao_status_tempos (solicitacao_id, status, inicio)
SELECT s.id, s.status, CASE WHEN s.status IN ('enviada', 'em_analise', 'rascunho') THEN s.criada_em ELSE coalesce(CASE s.status
         WHEN 'pendencia' THEN s.pendencia_em WHEN 'devolvida' THEN s.devolvida_em
         WHEN 'autorizada' THEN s.autorizada_em WHEN 'negada' THEN s.negada_em
         WHEN 'cancelada' THEN s.cancelada_em WHEN 'realizada' THEN s.realizada_em END, s.criada_em) END
  FROM public.regulacao_solicitacoes s
 WHERE NOT EXISTS (SELECT 1 FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id AND t.fim IS NULL);
-- os status fechados não têm relógio correndo
UPDATE public.regulacao_status_tempos t SET fim = t.inicio
  FROM public.regulacao_solicitacoes s
 WHERE s.id = t.solicitacao_id AND t.fim IS NULL
   AND s.status IN ('negada', 'cancelada', 'excluida', 'realizada', 'falta');

-- ── evolução do pedido ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_evolucoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  uuid NOT NULL REFERENCES public.regulacao_solicitacoes(id),
  texto           text NOT NULL CHECK (length(btrim(texto)) >= 10),
  sinais_vitais   text,
  autor_id        uuid NOT NULL REFERENCES public.perfis(id),
  em              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regulacao_evolucoes ON public.regulacao_evolucoes (solicitacao_id, em DESC);
DROP TRIGGER IF EXISTS trg_regulacao_evolucoes_so_insercao ON public.regulacao_evolucoes;
CREATE TRIGGER trg_regulacao_evolucoes_so_insercao BEFORE UPDATE OR DELETE ON public.regulacao_evolucoes
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.regulacao_evolucoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_evolucoes FROM anon, authenticated;

-- ── relógios ────────────────────────────────────────────────────────────────
-- Prazos que valem para a central (os valores de partida, se ela não ajustou).
CREATE OR REPLACE FUNCTION private.regulacao_prazos_de(p_central uuid)
RETURNS public.regulacao_prazos LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.regulacao_prazos;
BEGIN
  SELECT * INTO p FROM public.regulacao_prazos WHERE central_id = p_central;
  IF NOT FOUND THEN
    p.central_id := p_central; p.evolucao_h := 12; p.pendencia_h := 3; p.sem_evolucao_h := 72;
  END IF;
  RETURN p;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_prazos_de(uuid) FROM PUBLIC, anon, authenticated;

-- Relógios do pedido enquanto espera decisão (nulo nos demais status).
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
BEGIN
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida') THEN RETURN NULL; END IF;
  p := private.regulacao_prazos_de(s.central_id);
  SELECT coalesce(sum(extract(epoch FROM coalesce(t.fim, now()) - t.inicio)), 0)::bigint INTO v_central_seg
    FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id AND t.status IN ('enviada', 'em_analise');
  v_prazo := CASE v_ef WHEN 'emergencia' THEN p.fila_emergencia_min WHEN 'urgencia' THEN p.fila_urgencia_min
                       WHEN 'prioritaria' THEN p.fila_prioritaria_min WHEN 'eletiva' THEN p.fila_eletiva_min END;
  v_fila_atrasada := v_prazo IS NOT NULL AND v_central_seg > v_prazo * 60;

  IF s.status IN ('pendencia', 'devolvida') THEN
    SELECT t.inicio INTO v_desde FROM public.regulacao_status_tempos t WHERE t.solicitacao_id = s.id AND t.fim IS NULL;
    v_desde := coalesce(v_desde, CASE s.status WHEN 'pendencia' THEN s.pendencia_em ELSE s.devolvida_em END, s.criada_em);
    v_pend := jsonb_build_object('desde', v_desde, 'prazo_h', p.pendencia_h,
      'vence_em', v_desde + make_interval(hours => p.pendencia_h),
      'atrasada', now() > v_desde + make_interval(hours => p.pendencia_h));
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
    'pendencia', v_pend, 'evolucao', v_evol,
    'atrasado_central', v_correndo AND v_fila_atrasada,
    'atrasado_origem', coalesce((v_pend->>'atrasada')::boolean, false) OR coalesce((v_evol->>'atrasada')::boolean, false));
END $$;
REVOKE ALL ON FUNCTION private.regulacao_sla(public.regulacao_solicitacoes) FROM PUBLIC, anon, authenticated;

-- o JSON do pedido passa a trazer os relógios
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
$$;

-- o detalhe traz o tempo em cada status e as evoluções
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
    'pode_evoluir', private.regulacao_origem_pode(s) AND s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida'));
END $$;

-- ── atualizar evolução (origem) ─────────────────────────────────────────────
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
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida') THEN
    RAISE EXCEPTION 'Só se atualiza a evolução com o pedido esperando decisão.';
  END IF;
  IF length(btrim(coalesce(p_texto, ''))) < 10 THEN RAISE EXCEPTION 'Escreva a evolução (mínimo de 10 letras).'; END IF;
  INSERT INTO public.regulacao_evolucoes (solicitacao_id, texto, sinais_vitais, autor_id)
  VALUES (s.id, btrim(p_texto), nullif(btrim(coalesce(p_sinais_vitais, '')), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.regulacao_evento(s.id, 'evolucao_atualizada',
    jsonb_build_object('texto', btrim(p_texto), 'sinais_vitais', nullif(btrim(coalesce(p_sinais_vitais, '')), '')));
  -- avisa o regulador que está com o pedido
  IF s.assumida_por IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (s.assumida_por, s.central_id, current_date, 'reg_evolucao_' || s.numero,
            'Regulação nº ' || s.numero || ': a origem atualizou a evolução do paciente.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
      SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_atualizar_evolucao(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_atualizar_evolucao(uuid, text, text) TO authenticated;

-- ── prazos: leitura e ajuste ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_prazos_json(p_central uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.regulacao_prazos;
BEGIN
  p := private.regulacao_prazos_de(p_central);
  RETURN jsonb_build_object(
    'central_id', p_central,
    'fila', jsonb_build_object('emergencia', p.fila_emergencia_min, 'urgencia', p.fila_urgencia_min,
                               'prioritaria', p.fila_prioritaria_min, 'eletiva', p.fila_eletiva_min),
    'evolucao_h', p.evolucao_h, 'pendencia_h', p.pendencia_h, 'sem_evolucao_h', p.sem_evolucao_h,
    'ajustado', p.atualizado_por IS NOT NULL,
    'atualizado_em', CASE WHEN p.atualizado_por IS NOT NULL THEN p.atualizado_em END,
    'atualizado_por', (SELECT pe.nome_completo FROM public.perfis pe WHERE pe.id = p.atualizado_por));
END $$;
REVOKE ALL ON FUNCTION private.regulacao_prazos_json(uuid) FROM PUBLIC, anon, authenticated;

-- Prazos da central da rede desta unidade (qualquer unidade da organização).
CREATE OR REPLACE FUNCTION public.regulacao_prazos(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_central uuid;
BEGIN
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c JOIN public.unidades u ON u.organizacao_id = c.organizacao_id
   WHERE u.id = p_unidade;
  IF v_central IS NULL THEN RETURN NULL; END IF;
  RETURN private.regulacao_prazos_json(v_central);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_prazos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_prazos(uuid) TO authenticated;

-- A central ajusta (regulador ou gestor da central). Prazo da fila vazio = sem prazo.
CREATE OR REPLACE FUNCTION public.regulacao_definir_prazos(p_central uuid, p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v_antes jsonb;
  v_min integer[];
  v_evol integer; v_pend integer; v_sem integer;
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
  IF v_evol NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Evolução: de 1 a 168 horas.'; END IF;
  IF v_pend NOT BETWEEN 1 AND 72 THEN RAISE EXCEPTION 'Resposta à pendência: de 1 a 72 horas.'; END IF;
  IF v_sem NOT BETWEEN 2 AND 720 OR v_sem <= v_evol THEN
    RAISE EXCEPTION 'Sem evolução: até 720 horas e maior que o prazo da evolução.';
  END IF;
  v_antes := private.regulacao_prazos_json(p_central);
  INSERT INTO public.regulacao_prazos (central_id, fila_emergencia_min, fila_urgencia_min, fila_prioritaria_min, fila_eletiva_min,
    evolucao_h, pendencia_h, sem_evolucao_h, atualizado_por, atualizado_em)
  VALUES (p_central, v_min[1], v_min[2], v_min[3], v_min[4], v_evol, v_pend, v_sem, private.meu_perfil_id(), now())
  ON CONFLICT (central_id) DO UPDATE SET
    fila_emergencia_min = excluded.fila_emergencia_min, fila_urgencia_min = excluded.fila_urgencia_min,
    fila_prioritaria_min = excluded.fila_prioritaria_min, fila_eletiva_min = excluded.fila_eletiva_min,
    evolucao_h = excluded.evolucao_h, pendencia_h = excluded.pendencia_h, sem_evolucao_h = excluded.sem_evolucao_h,
    atualizado_por = excluded.atualizado_por, atualizado_em = now();
  INSERT INTO public.regulacao_prazos_historico (central_id, antes, depois, por)
  VALUES (p_central, v_antes - 'atualizado_por' - 'atualizado_em',
          private.regulacao_prazos_json(p_central) - 'atualizado_por' - 'atualizado_em', private.meu_perfil_id())
  RETURNING id INTO v_hist;
  PERFORM private.registrar_auditoria('regulacao_prazos_ajustados', 'regulacao_prazos_historico', v_hist, p_central, NULL);
  RETURN private.regulacao_prazos_json(p_central);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_definir_prazos(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_definir_prazos(uuid, jsonb) TO authenticated;

-- ── painel ──────────────────────────────────────────────────────────────────
-- Central: todos os pedidos da rede esperando decisão. Origem (médico ou
-- gestor): os da própria unidade. Filtros: tipo, prioridade, só atrasados.
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
       WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida')
         AND ((v_central AND s.central_id = p_unidade) OR (NOT v_central AND s.unidade_origem_id = p_unidade))
    ), filtrada AS (
      SELECT b.* FROM base b
       WHERE (NOT f ? 'tipo' OR (b.s).tipo = f->>'tipo')
         AND (NOT f ? 'prioridade' OR coalesce((b.s).prioridade_regulador, (b.s).prioridade) = f->>'prioridade')
         AND (NOT v_so_atrasados OR (b.sla->>'atrasado_central')::boolean OR (b.sla->>'atrasado_origem')::boolean)
    )
    SELECT jsonb_build_object(
      'central', v_central,
      'dados', coalesce((SELECT jsonb_agg(private.regulacao_json_fila(x.s) ORDER BY
                 CASE WHEN v_central THEN (x.sla->>'atrasado_central')::boolean ELSE (x.sla->>'atrasado_origem')::boolean END DESC,
                 ((x.sla->>'atrasado_central')::boolean OR (x.sla->>'atrasado_origem')::boolean) DESC,
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
          'risco_cancelamento', count(*) FILTER (WHERE (b.sla->'evolucao'->>'risco_cancelamento')::boolean))
        FROM base b),
      'prazos', private.regulacao_prazos_json(CASE WHEN v_central THEN p_unidade
                  ELSE (SELECT c.unidade_id FROM public.centrais_regulacao c JOIN public.unidades u ON u.organizacao_id = c.organizacao_id
                         WHERE u.id = p_unidade) END),
      'agora', now()));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_sla_painel(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_sla_painel(uuid, jsonb) TO authenticated;

-- ── avisos de prazo (job) ───────────────────────────────────────────────────
-- Uma vez por dia e por relógio: não volta a marcar como não lido.
CREATE OR REPLACE FUNCTION private.regulacao_sla_avisar()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  v jsonb;
  n integer := 0;
  k integer;
BEGIN
  FOR s IN SELECT * FROM public.regulacao_solicitacoes WHERE status IN ('enviada', 'em_analise', 'pendencia', 'devolvida') LOOP
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
    IF (v->>'atrasado_central')::boolean THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      SELECT DISTINCT q, s.central_id, current_date, 'reg_prazo_fila_' || s.numero,
             'Regulação nº ' || s.numero || ': passou do prazo da fila (' || (v->'fila'->>'prazo_min') || ' min) sem decisão.'
        FROM (SELECT s.assumida_por AS q WHERE s.assumida_por IS NOT NULL
              UNION
              SELECT vi.perfil_id FROM public.vinculos vi
               WHERE s.assumida_por IS NULL AND vi.unidade_id = s.central_id AND vi.papel = 'regulador' AND vi.ativo) r
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_sla_avisar() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'regulacao-sla-avisos';
SELECT cron.schedule('regulacao-sla-avisos', '*/15 * * * *', 'SELECT private.regulacao_sla_avisar();');
