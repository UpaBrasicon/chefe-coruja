-- Fase 5B, tarefa 1: conta do atendimento. Decisões do RT em 16/10/2026
-- ("1a 2a 3a 4a 5a 6a 7a"):
--
--  1a. Só SUS nesta fase: a conta espelha a produção (BPA, AIH, APAC); o
--      valor do SIGTAP é a referência (itens e valores nas tarefas 2 e 3).
--  2a. Contas separadas: a do atendimento na porta (ambulatorial, vai no BPA)
--      e a da internação (vai na AIH), com o link para a conta da porta de
--      onde o paciente veio. Observação fica na conta da porta; a conta de
--      internação nasce quando o paciente é internado (internado_em).
--  3a. A conta abre sozinha, com o atendimento ou a internação.
--  4a. Etapas: aberta → em conferência → fechada → faturada; reabrir com motivo.
--  5a. Quem tem o papel faturamento conduz e fecha; reabrir é do gestor, com motivo.
--  6a. Pagador vem da categoria do paciente na abertura; trocar fica registrado.
--  7a. Nesta tarefa só a estrutura e o vínculo com o atendimento.

CREATE TABLE public.contas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  tipo            text NOT NULL CHECK (tipo IN ('ambulatorial', 'internacao')),
  episodio_id     uuid REFERENCES public.episodios(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  conta_origem_id uuid REFERENCES public.contas(id),
  numero          text NOT NULL,
  pagador         text NOT NULL DEFAULT 'sus' CHECK (pagador IN ('sus', 'convenio', 'particular')),
  status          text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_conferencia', 'fechada', 'faturada')),
  aberta_em       timestamptz NOT NULL DEFAULT now(),
  status_em       timestamptz NOT NULL DEFAULT now(),
  status_por      uuid REFERENCES public.perfis(id),
  CONSTRAINT contas_vinculo CHECK ((tipo = 'ambulatorial' AND episodio_id IS NOT NULL AND internacao_id IS NULL)
                                OR (tipo = 'internacao' AND internacao_id IS NOT NULL)),
  CONSTRAINT contas_numero_unico UNIQUE (unidade_id, numero)
);
COMMENT ON TABLE public.contas IS 'Conta do atendimento (Fase 5B): ambulatorial (porta/observação, BPA) ou de internação (AIH), ligadas pela conta de origem.';
CREATE UNIQUE INDEX contas_um_por_episodio ON public.contas (episodio_id) WHERE tipo = 'ambulatorial';
CREATE UNIQUE INDEX contas_um_por_internacao ON public.contas (internacao_id) WHERE tipo = 'internacao';
CREATE INDEX contas_unidade_status ON public.contas (unidade_id, status, aberta_em DESC);

CREATE TABLE public.conta_eventos (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas(id),
  evento   text NOT NULL,
  de       text,
  para     text,
  motivo   text,
  por      uuid REFERENCES public.perfis(id),
  em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conta_eventos_conta ON public.conta_eventos (conta_id, em);

-- leitura: faturamento e gestor da unidade (gravação só pelas funções)
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contas_leitura ON public.contas FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.tenho_papel(unidade_id, 'faturamento') OR private.gestor_da_unidade(unidade_id));
CREATE POLICY conta_eventos_leitura ON public.conta_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contas c WHERE c.id = conta_id
                  AND (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento') OR private.gestor_da_unidade(c.unidade_id))));
REVOKE ALL ON public.contas, public.conta_eventos FROM anon, authenticated;
GRANT SELECT ON public.contas, public.conta_eventos TO authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.contas FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.conta_eventos FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

-- número por unidade e ano: A-2026.000001 (ambulatorial), I-2026.000001 (internação)
CREATE TABLE private.conta_sequencia (
  unidade_id uuid NOT NULL,
  ano        integer NOT NULL,
  tipo       text NOT NULL,
  ultimo     integer NOT NULL,
  PRIMARY KEY (unidade_id, ano, tipo)
);

CREATE OR REPLACE FUNCTION private.abrir_conta(p_tipo text, p_unidade uuid, p_paciente uuid, p_episodio uuid,
                                               p_internacao uuid, p_origem uuid, p_quando timestamptz DEFAULT now())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ano integer := extract(year FROM (p_quando AT TIME ZONE 'America/Sao_Paulo'))::integer;
  v_n integer;
  v_id uuid;
  v_pagador text;
BEGIN
  INSERT INTO private.conta_sequencia (unidade_id, ano, tipo, ultimo) VALUES (p_unidade, v_ano, p_tipo, 1)
  ON CONFLICT (unidade_id, ano, tipo) DO UPDATE SET ultimo = private.conta_sequencia.ultimo + 1
  RETURNING ultimo INTO v_n;
  SELECT coalesce(categoria, 'sus') INTO v_pagador FROM public.pacientes WHERE id = p_paciente;
  INSERT INTO public.contas (unidade_id, paciente_id, tipo, episodio_id, internacao_id, conta_origem_id, numero, pagador, aberta_em, status_em)
  VALUES (p_unidade, p_paciente, p_tipo, p_episodio, p_internacao, p_origem,
          CASE p_tipo WHEN 'ambulatorial' THEN 'A-' ELSE 'I-' END || v_ano || '.' || lpad(v_n::text, 6, '0'),
          coalesce(v_pagador, 'sus'), p_quando, p_quando)
  RETURNING id INTO v_id;
  INSERT INTO public.conta_eventos (conta_id, evento, para, em) VALUES (v_id, 'aberta', 'aberta', p_quando);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.abrir_conta(text, uuid, uuid, uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- 3a. abre sozinha: atendimento na porta
CREATE OR REPLACE FUNCTION private.trg_conta_do_episodio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.contas WHERE episodio_id = NEW.id AND tipo = 'ambulatorial') THEN
    PERFORM private.abrir_conta('ambulatorial', NEW.unidade_id, NEW.paciente_id, NEW.id, NULL, NULL, coalesce(NEW.chegada_em, now()));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_conta_do_episodio AFTER INSERT ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.trg_conta_do_episodio();

-- 2a, 3a. internação: nasce quando o paciente é internado, ligada à conta da porta
CREATE OR REPLACE FUNCTION private.trg_conta_da_internacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.internado_em IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.contas WHERE internacao_id = NEW.id AND tipo = 'internacao') THEN
    PERFORM private.abrir_conta('internacao', NEW.unidade_id, NEW.paciente_id, NULL, NEW.id,
      (SELECT c.id FROM public.contas c WHERE c.episodio_id = NEW.episodio_id AND c.tipo = 'ambulatorial'),
      NEW.internado_em);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_conta_da_internacao AFTER INSERT OR UPDATE OF internado_em ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.trg_conta_da_internacao();

-- contas para o que está em andamento ou começou no mês corrente (competência atual)
DO $$
DECLARE r record; v_ini timestamptz := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  FOR r IN SELECT e.* FROM public.episodios e
            WHERE (e.etapa <> 'encerrado' OR e.chegada_em >= v_ini)
              AND NOT EXISTS (SELECT 1 FROM public.contas c WHERE c.episodio_id = e.id)
            ORDER BY e.chegada_em LOOP
    PERFORM private.abrir_conta('ambulatorial', r.unidade_id, r.paciente_id, r.id, NULL, NULL, coalesce(r.chegada_em, now()));
  END LOOP;
  FOR r IN SELECT i.* FROM public.internacoes i
            WHERE i.internado_em IS NOT NULL AND (i.data_alta IS NULL OR i.data_alta >= v_ini)
              AND NOT EXISTS (SELECT 1 FROM public.contas c WHERE c.internacao_id = i.id)
            ORDER BY i.internado_em LOOP
    PERFORM private.abrir_conta('internacao', r.unidade_id, r.paciente_id, NULL, r.id,
      (SELECT c.id FROM public.contas c WHERE c.episodio_id = r.episodio_id AND c.tipo = 'ambulatorial'), r.internado_em);
  END LOOP;
END $$;

-- ── leitura ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.pode_ver_contas(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR private.tenho_papel(p_unidade, 'faturamento') OR private.gestor_da_unidade(p_unidade)
$$;

-- atendimento terminou? (a conta só fecha depois)
CREATE OR REPLACE FUNCTION private.conta_atendimento_terminou(c public.contas)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE c.tipo
    WHEN 'ambulatorial' THEN (SELECT e.etapa = 'encerrado' FROM public.episodios e WHERE e.id = c.episodio_id)
    ELSE (SELECT i.data_alta IS NOT NULL FROM public.internacoes i WHERE i.id = c.internacao_id) END
$$;

CREATE OR REPLACE FUNCTION private.conta_json(c public.contas)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', c.id, 'numero', c.numero, 'tipo', c.tipo, 'status', c.status, 'pagador', c.pagador,
    'aberta_em', c.aberta_em, 'status_em', c.status_em, 'status_por', (SELECT nome_completo FROM public.perfis WHERE id = c.status_por),
    'paciente', (SELECT jsonb_build_object('id', p.id, 'nome', coalesce(p.nome_social, p.nome), 'prontuario', p.prontuario)
                   FROM public.pacientes p WHERE p.id = c.paciente_id),
    'atendimento', CASE c.tipo
      WHEN 'ambulatorial' THEN (SELECT jsonb_build_object('inicio', e.chegada_em, 'fim', coalesce(e.encerrado_em, e.desfecho_em),
                                         'situacao', e.etapa, 'desfecho', e.desfecho,
                                         'setor', (SELECT s.nome FROM public.setores s WHERE s.id = e.setor_id))
                                  FROM public.episodios e WHERE e.id = c.episodio_id)
      ELSE (SELECT jsonb_build_object('inicio', i.internado_em, 'fim', i.data_alta, 'situacao', i.status,
                                      'setor', (SELECT s.nome FROM public.setores s WHERE s.id = i.setor_atual_id))
              FROM public.internacoes i WHERE i.id = c.internacao_id) END,
    'atendimento_terminou', coalesce(private.conta_atendimento_terminou(c), false),
    -- 2a: a conta da porta e a da internação que saiu dela
    'origem', (SELECT jsonb_build_object('id', o.id, 'numero', o.numero, 'status', o.status) FROM public.contas o WHERE o.id = c.conta_origem_id),
    'derivadas', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'numero', d.numero, 'status', d.status) ORDER BY d.aberta_em)
                             FROM public.contas d WHERE d.conta_origem_id = c.id), '[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION private.pode_ver_contas(uuid), private.conta_atendimento_terminou(public.contas), private.conta_json(public.contas)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.contas_da_unidade(p_unidade uuid, p_status text DEFAULT NULL, p_tipo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'contas', coalesce((SELECT jsonb_agg(private.conta_json(c) ORDER BY c.aberta_em DESC) FROM (
                SELECT * FROM public.contas c
                 WHERE c.unidade_id = p_unidade AND (p_status IS NULL OR c.status = p_status) AND (p_tipo IS NULL OR c.tipo = p_tipo)
                 ORDER BY c.aberta_em DESC LIMIT 500) c), '[]'::jsonb),
    'totais', (SELECT jsonb_object_agg(s, (SELECT count(*) FROM public.contas c WHERE c.unidade_id = p_unidade AND c.status = s
                                             AND (p_tipo IS NULL OR c.tipo = p_tipo)))
                 FROM unnest(ARRAY['aberta', 'em_conferencia', 'fechada', 'faturada']) s));
END $$;

CREATE OR REPLACE FUNCTION public.conta_detalhe(p_conta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN private.conta_json(c) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object('evento', ev.evento, 'de', ev.de, 'para', ev.para, 'motivo', ev.motivo,
                               'por', (SELECT nome_completo FROM public.perfis WHERE id = ev.por), 'em', ev.em) ORDER BY ev.em)
                          FROM public.conta_eventos ev WHERE ev.conta_id = c.id), '[]'::jsonb),
    'pode_conduzir', private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento'),
    'pode_reabrir', private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id));
END $$;

-- ── etapas (4a, 5a) ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mudar_etapa_conta(p_conta uuid, p_para text, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.contas;
  v_eu uuid := private.meu_perfil_id();
  v_faturamento boolean;
  v_gestor boolean;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_evento text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT private.pode_ver_contas(c.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: contas são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_faturamento := private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento');
  v_gestor := private.eh_super_admin() OR private.gestor_da_unidade(c.unidade_id);

  IF c.status = 'aberta' AND p_para = 'em_conferencia' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'A conferência é do faturamento.'; END IF;
    v_evento := 'conferencia';
  ELSIF c.status = 'em_conferencia' AND p_para = 'aberta' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'A conferência é do faturamento.'; END IF;
    IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Diga por que a conta volta a aberta (mínimo de 10 letras).'; END IF;
    v_evento := 'devolvida';
  ELSIF c.status = 'em_conferencia' AND p_para = 'fechada' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'Quem fecha a conta é o faturamento.'; END IF;
    IF NOT coalesce(private.conta_atendimento_terminou(c), false) THEN
      RAISE EXCEPTION '%', CASE c.tipo WHEN 'ambulatorial' THEN 'O atendimento ainda não terminou: a conta fecha depois do desfecho.'
                                      ELSE 'A internação ainda não teve alta: a conta fecha depois da alta.' END;
    END IF;
    v_evento := 'fechada';
  ELSIF c.status = 'fechada' AND p_para = 'faturada' THEN
    IF NOT v_faturamento THEN RAISE EXCEPTION 'Quem marca a conta como faturada é o faturamento.'; END IF;
    v_evento := 'faturada';
  ELSIF c.status IN ('fechada', 'faturada') AND p_para = 'aberta' THEN
    IF NOT v_gestor THEN RAISE EXCEPTION 'Reabrir conta fechada é do gestor da unidade.'; END IF;
    IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Diga por que a conta é reaberta (mínimo de 10 letras).'; END IF;
    v_evento := 'reaberta';
  ELSE
    RAISE EXCEPTION 'Mudança de etapa não permitida: de % para %.', c.status, p_para;
  END IF;

  UPDATE public.contas SET status = p_para, status_em = now(), status_por = v_eu WHERE id = c.id;
  INSERT INTO public.conta_eventos (conta_id, evento, de, para, motivo, por) VALUES (c.id, v_evento, c.status, p_para, v_motivo, v_eu);
  PERFORM private.registrar_auditoria('conta_' || v_evento, 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'de', c.status, 'para', p_para, 'motivo', v_motivo));
  RETURN public.conta_detalhe(c.id);
END $$;

-- 6a. troca do pagador (enquanto a conta não fechou)
CREATE OR REPLACE FUNCTION public.trocar_pagador_conta(p_conta uuid, p_pagador text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.contas; v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.contas WHERE id = p_conta FOR UPDATE;
  IF c.id IS NULL OR NOT (private.eh_super_admin() OR private.tenho_papel(c.unidade_id, 'faturamento')) THEN
    RAISE EXCEPTION 'Acesso negado: o pagador é trocado pelo faturamento.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_pagador NOT IN ('sus', 'convenio', 'particular') THEN RAISE EXCEPTION 'Pagador: SUS, convênio ou particular.'; END IF;
  IF c.status IN ('fechada', 'faturada') THEN RAISE EXCEPTION 'Conta fechada: o gestor reabre antes de trocar o pagador.'; END IF;
  IF p_pagador = c.pagador THEN RAISE EXCEPTION 'A conta já está com este pagador.'; END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Diga por que o pagador muda (mínimo de 10 letras).'; END IF;
  UPDATE public.contas SET pagador = p_pagador WHERE id = c.id;
  INSERT INTO public.conta_eventos (conta_id, evento, de, para, motivo, por) VALUES (c.id, 'pagador', c.pagador, p_pagador, v_motivo, v_eu);
  PERFORM private.registrar_auditoria('conta_pagador', 'contas', c.id, c.unidade_id,
    jsonb_build_object('numero', c.numero, 'de', c.pagador, 'para', p_pagador, 'motivo', v_motivo));
  RETURN public.conta_detalhe(c.id);
END $$;

REVOKE ALL ON FUNCTION public.contas_da_unidade(uuid, text, text), public.conta_detalhe(uuid),
  public.mudar_etapa_conta(uuid, text, text), public.trocar_pagador_conta(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contas_da_unidade(uuid, text, text), public.conta_detalhe(uuid),
  public.mudar_etapa_conta(uuid, text, text), public.trocar_pagador_conta(uuid, text, text) TO authenticated;
