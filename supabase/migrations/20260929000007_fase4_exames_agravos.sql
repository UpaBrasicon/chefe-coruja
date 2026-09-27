-- Fase 4.7 — exames pedidos com resultado e agravos de notificação,
-- os dois como impeditivos de alta (herdados da fase 3).
--
--  * Exames: cada linha de um pedido de exames EMITIDO vira um exame
--    "pedido". Sai da pendência com o resultado registrado ou cancelado com
--    motivo. "Alta exige exames sem pendência" (ESTADO.md, Etapa 12): vale
--    na alta da internação e nas altas da porta.
--  * Agravos: o médico marca o agravo suspeito; a alta fica impedida até a
--    notificação ser registrada (número do SINAN opcional — o envio ao SINAN
--    é fora do sistema) ou o agravo ser descartado com motivo. A lista
--    automática CID → agravo da LNNC fica para quando a vigilância aprovar
--    um mapeamento (não se inventa).

-- ── exames ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exames_pedidos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id     uuid REFERENCES public.episodios(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  documento_id    uuid REFERENCES public.documentos_clinicos(id),
  exame           text NOT NULL,
  pedido_por      uuid NOT NULL REFERENCES public.perfis(id),
  pedido_em       timestamptz NOT NULL DEFAULT now(),
  situacao        text NOT NULL DEFAULT 'pedido' CHECK (situacao IN ('pedido', 'resultado', 'cancelado')),
  resultado       text,
  resolvido_por   uuid REFERENCES public.perfis(id),
  resolvido_em    timestamptz,
  motivo_cancelamento text
);
CREATE INDEX IF NOT EXISTS exames_pedidos_pendentes ON public.exames_pedidos (paciente_id) WHERE situacao = 'pedido';
ALTER TABLE public.exames_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exames_pedidos_select ON public.exames_pedidos;
CREATE POLICY exames_pedidos_select ON public.exames_pedidos FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS exames_pedidos_segundo_fator ON public.exames_pedidos;
CREATE POLICY exames_pedidos_segundo_fator ON public.exames_pedidos AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());
REVOKE INSERT, UPDATE, DELETE ON public.exames_pedidos FROM anon, authenticated;
GRANT SELECT ON public.exames_pedidos TO authenticated;

-- pedido de exames emitido → uma linha por exame
CREATE OR REPLACE FUNCTION private.pedido_emitido_vira_exames() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texto text; l text;
BEGIN
  IF NEW.tipo_documento <> 'pedido_exames' OR NEW.estado <> 'ativo' OR NEW.retificacao_de IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado = 'ativo' THEN RETURN NEW; END IF;
  BEGIN
    v_texto := coalesce(NEW.conteudo::jsonb -> 'pedido' ->> 'texto', NEW.conteudo::jsonb -> 'exames' ->> 'texto', '');
  EXCEPTION WHEN others THEN v_texto := '';
  END;
  FOREACH l IN ARRAY regexp_split_to_array(v_texto, '\n+') LOOP
    l := btrim(regexp_replace(l, '^\s*[-*•]\s*', ''));
    CONTINUE WHEN length(l) < 2;
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, internacao_id, documento_id, exame, pedido_por)
    VALUES (NEW.unidade_id, NEW.paciente_id, NEW.episodio_id, NEW.internacao_id, NEW.id, left(l, 200), NEW.autor_id);
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pedido_vira_exames ON public.documentos_clinicos;
CREATE TRIGGER trg_pedido_vira_exames AFTER INSERT OR UPDATE OF estado ON public.documentos_clinicos
  FOR EACH ROW EXECUTE FUNCTION private.pedido_emitido_vira_exames();

CREATE OR REPLACE FUNCTION public.resolver_exame(p_exame uuid, p_resultado text DEFAULT NULL, p_motivo_cancelamento text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame FOR UPDATE;
  IF NOT FOUND OR e.situacao <> 'pedido' THEN RAISE EXCEPTION 'Exame não encontrado ou já resolvido.'; END IF;
  IF NOT private.paciente_no_meu_plantao(e.paciente_id)
     OR NOT (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE OR private.sou_enfermagem(e.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
  END IF;
  IF p_resultado IS NOT NULL AND length(btrim(p_resultado)) >= 1 THEN
    UPDATE public.exames_pedidos SET situacao = 'resultado', resultado = btrim(p_resultado), resolvido_por = private.meu_perfil_id(), resolvido_em = now()
     WHERE id = e.id;
  ELSIF length(btrim(coalesce(p_motivo_cancelamento, ''))) >= 10 THEN
    UPDATE public.exames_pedidos SET situacao = 'cancelado', motivo_cancelamento = btrim(p_motivo_cancelamento),
           resolvido_por = private.meu_perfil_id(), resolvido_em = now()
     WHERE id = e.id;
  ELSE
    RAISE EXCEPTION 'Registre o resultado, ou cancele com motivo (mínimo de 10 letras).';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.resolver_exame(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_exame(uuid, text, text) TO authenticated;

-- ── agravos de notificação ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agravos_notificacao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id     uuid REFERENCES public.episodios(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  agravo          text NOT NULL,
  cid             text,
  situacao        text NOT NULL DEFAULT 'suspeito' CHECK (situacao IN ('suspeito', 'notificado', 'descartado')),
  suspeito_por    uuid NOT NULL REFERENCES public.perfis(id),
  suspeito_em     timestamptz NOT NULL DEFAULT now(),
  numero_sinan    text,
  resolvido_por   uuid REFERENCES public.perfis(id),
  resolvido_em    timestamptz,
  motivo_descarte text
);
ALTER TABLE public.agravos_notificacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agravos_select ON public.agravos_notificacao;
CREATE POLICY agravos_select ON public.agravos_notificacao FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS agravos_segundo_fator ON public.agravos_notificacao;
CREATE POLICY agravos_segundo_fator ON public.agravos_notificacao AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());
REVOKE INSERT, UPDATE, DELETE ON public.agravos_notificacao FROM anon, authenticated;
GRANT SELECT ON public.agravos_notificacao TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_agravo(p_paciente uuid, p_agravo text, p_cid text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF NOT private.paciente_no_meu_plantao(p_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A suspeita de agravo é marcada pelo médico de plantão.';
  END IF;
  IF length(btrim(coalesce(p_agravo, ''))) < 3 THEN RAISE EXCEPTION 'Informe o agravo.'; END IF;
  INSERT INTO public.agravos_notificacao (unidade_id, paciente_id, episodio_id, internacao_id, agravo, cid, suspeito_por)
  VALUES (v_unidade, p_paciente, private.episodio_aberto(p_paciente),
          (SELECT id FROM public.internacoes WHERE paciente_id = p_paciente AND status IN ('admitido', 'em_observacao', 'internado') LIMIT 1),
          btrim(p_agravo), private.cid_normalizado(p_cid), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.resolver_agravo(p_agravo uuid, p_notificado boolean, p_numero_sinan text DEFAULT NULL, p_motivo_descarte text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.agravos_notificacao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.agravos_notificacao WHERE id = p_agravo FOR UPDATE;
  IF NOT FOUND OR a.situacao <> 'suspeito' THEN RAISE EXCEPTION 'Agravo não encontrado ou já resolvido.'; END IF;
  IF NOT private.paciente_no_meu_plantao(a.paciente_id)
     OR NOT (private.tenho_papel(a.unidade_id, 'plantonista') IS TRUE OR private.tenho_papel(a.unidade_id, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
  END IF;
  IF NOT p_notificado AND length(btrim(coalesce(p_motivo_descarte, ''))) < 10 THEN
    RAISE EXCEPTION 'Descartar a suspeita exige motivo (mínimo de 10 letras).';
  END IF;
  UPDATE public.agravos_notificacao
     SET situacao = CASE WHEN p_notificado THEN 'notificado' ELSE 'descartado' END,
         numero_sinan = CASE WHEN p_notificado THEN nullif(btrim(p_numero_sinan), '') END,
         motivo_descarte = CASE WHEN p_notificado THEN NULL ELSE btrim(p_motivo_descarte) END,
         resolvido_por = private.meu_perfil_id(), resolvido_em = now()
   WHERE id = a.id;
END $$;
REVOKE ALL ON FUNCTION public.marcar_agravo(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolver_agravo(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_agravo(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_agravo(uuid, boolean, text, text) TO authenticated;

-- ── impeditivos: internação ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.impeditivos_alta(p_internacao uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x ->> 'tipo'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('tipo', CASE WHEN p.tipo = 'parecer' THEN 'parecer' ELSE 'pendencia' END,
                              'id', p.id,
                              'descricao', CASE WHEN p.tipo = 'parecer' THEN 'Parecer sem resposta: ' ELSE 'Pendência impeditiva: ' END || p.descricao) x
      FROM public.pendencias p
     WHERE p.internacao_id = p_internacao AND p.situacao = 'aberta' AND p.impeditiva
    UNION ALL
    SELECT jsonb_build_object('tipo', 'documento', 'id', d.id, 'autor_id', d.autor_id,
                              'descricao', 'Documento do PEP aberto (rascunho): ' || replace(d.tipo_documento, '_', ' ')
                                || ' de ' || coalesce((SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = d.autor_id), '—'))
      FROM public.documentos_clinicos d
      JOIN public.internacoes i ON i.id = p_internacao
     WHERE d.paciente_id = i.paciente_id AND d.estado = 'rascunho'
       AND (d.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND d.episodio_id = i.episodio_id))
    UNION ALL
    SELECT jsonb_build_object('tipo', 'passagem', 'id', pp.id, 'descricao', 'Passagem de plantão aguardando aceite')
      FROM public.passagens_plantao pp
     WHERE pp.internacao_id = p_internacao AND pp.situacao = 'aguardando'
    UNION ALL
    SELECT jsonb_build_object('tipo', 'exame', 'id', e.id, 'descricao', 'Exame sem resultado: ' || e.exame)
      FROM public.exames_pedidos e JOIN public.internacoes i ON i.id = p_internacao
     WHERE e.paciente_id = i.paciente_id AND e.situacao = 'pedido'
       AND (e.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND e.episodio_id = i.episodio_id))
    UNION ALL
    SELECT jsonb_build_object('tipo', 'agravo', 'id', a.id, 'descricao', 'Agravo suspeito sem notificação registrada: ' || a.agravo)
      FROM public.agravos_notificacao a JOIN public.internacoes i ON i.id = p_internacao
     WHERE a.paciente_id = i.paciente_id AND a.situacao = 'suspeito'
       AND (a.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND a.episodio_id = i.episodio_id))
  ) s
$$;

-- ── impeditivos: altas da porta ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.desfecho_confere_pendencias() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE falta text;
BEGIN
  IF NEW.desfecho IN ('alta', 'alta_apos_medicacao') AND OLD.desfecho IS DISTINCT FROM NEW.desfecho THEN
    SELECT string_agg(exame, ', ') INTO falta FROM public.exames_pedidos WHERE episodio_id = NEW.id AND situacao = 'pedido';
    IF falta IS NOT NULL THEN
      RAISE EXCEPTION 'Alta: exames pedidos sem resultado: %. Registre o resultado ou cancele com motivo.', falta;
    END IF;
    SELECT string_agg(agravo, ', ') INTO falta FROM public.agravos_notificacao WHERE episodio_id = NEW.id AND situacao = 'suspeito';
    IF falta IS NOT NULL THEN
      RAISE EXCEPTION 'Alta: agravo suspeito sem notificação registrada: %.', falta;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_desfecho_confere_pendencias ON public.episodios;
CREATE TRIGGER trg_desfecho_confere_pendencias BEFORE UPDATE OF desfecho ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.desfecho_confere_pendencias();
