-- Fase 3.1 — o desfecho da porta abre o box (observação) ou o leito
-- (internação), ligado ao episódio; a observação é uma PENDÊNCIA de 6 horas;
-- pendências do leito e do box com tipo, prazo e autor.
--
-- Regras (ESTADO.md 24/09 e D8):
--  * box automático: o primeiro box livre da Observação fica com o paciente;
--  * a observação vence em 6h contadas da entrada no box (relógio do servidor);
--  * sair da observação (alta ou internação) resolve a pendência de observação;
--  * fechar a internação fecha o episódio; o parecer sem resposta impede a alta.

-- ── internação pertence ao episódio ─────────────────────────────────────────
ALTER TABLE public.internacoes ADD COLUMN IF NOT EXISTS episodio_id uuid REFERENCES public.episodios(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_internacoes_episodio ON public.internacoes (episodio_id) WHERE episodio_id IS NOT NULL;

-- ── pendências ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pendencias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id    uuid NOT NULL REFERENCES public.internacoes(id),
  tipo             text NOT NULL CHECK (tipo IN ('observacao', 'reavaliacao', 'exame', 'parecer', 'regulacao', 'outro')),
  descricao        text NOT NULL,
  prazo            timestamptz,
  impeditiva       boolean NOT NULL DEFAULT false,
  autor_id         uuid NOT NULL REFERENCES public.perfis(id),
  criada_em        timestamptz NOT NULL DEFAULT now(),
  situacao         text NOT NULL DEFAULT 'aberta' CHECK (situacao IN ('aberta', 'concluida', 'cancelada')),
  resolvida_em     timestamptz,
  resolvida_por    uuid REFERENCES public.perfis(id),
  motivo_resolucao text
);
CREATE INDEX IF NOT EXISTS pendencias_internacao ON public.pendencias (internacao_id, situacao, prazo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pendencia_observacao_aberta
  ON public.pendencias (internacao_id) WHERE tipo = 'observacao' AND situacao = 'aberta';

ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pendencias_select ON public.pendencias;
CREATE POLICY pendencias_select ON public.pendencias FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS pendencias_segundo_fator ON public.pendencias;
CREATE POLICY pendencias_segundo_fator ON public.pendencias AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());
REVOKE INSERT, UPDATE, DELETE ON public.pendencias FROM anon, authenticated;
GRANT SELECT ON public.pendencias TO authenticated;

-- Quem cuida do paciente internado: escala no setor atual da internação.
-- O gestor também registra pendência (é o "orientar conduta"), mas não resolve
-- a de observação, que só sai com conduta médica.
CREATE OR REPLACE FUNCTION private.cuido_da_internacao(i public.internacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
$$;

-- ── abrir box / leito a partir do episódio ──────────────────────────────────
CREATE OR REPLACE FUNCTION private.internar_do_episodio(e public.episodios, p_status text, p_setor uuid, p_leito uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_org uuid;
  v_id uuid;
  v_estado jsonb;
BEGIN
  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = e.unidade_id;
  v_estado := jsonb_build_object('status', p_status, 'setor', p_setor, 'leito', p_leito,
    'tipo_internacao', CASE WHEN p_status = 'em_observacao' THEN 'observacao' ELSE 'urgencia' END,
    'origem', 'emergencia', 'episodio', e.id);
  INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, episodio_id, tipo_internacao, origem_admissao,
                                  status, leito_atual_id, setor_atual_id, data_entrada_setor)
  VALUES (v_org, e.unidade_id, e.paciente_id, e.id,
          CASE WHEN p_status = 'em_observacao' THEN 'observacao' ELSE 'urgencia' END, 'emergencia',
          p_status, p_leito, p_setor, now())
  RETURNING id INTO v_id;
  INSERT INTO public.eventos_adt (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento,
    estado_antes, estado_depois, setor_destino_id, leito_destino_id, autor_id, motivo, hash_previo, hash_conteudo)
  VALUES (1, v_org, e.unidade_id, v_id, e.paciente_id, 'admissao', NULL, v_estado, p_setor, p_leito, v_perfil,
          'Desfecho da porta', NULL, private.hash_evento(1, 'admissao', v_estado, v_perfil, 'Desfecho da porta', NULL));
  IF p_leito IS NOT NULL THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito;
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (p_leito, e.unidade_id, 'ocupacao', 'livre', 'ocupado', v_id, v_perfil,
            CASE WHEN p_status = 'em_observacao' THEN 'Box automático' ELSE 'Internação' END);
  END IF;
  UPDATE public.pacientes SET setor_id = p_setor, updated_at = now() WHERE id = e.paciente_id;
  RETURN v_id;
END $$;

-- Primeiro box livre da Observação, respeitando o público do setor.
CREATE OR REPLACE FUNCTION private.box_livre(p_unidade uuid, p_publico text)
RETURNS TABLE (setor_id uuid, leito_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id, l.id
  FROM public.setores s
  LEFT JOIN public.leitos l ON l.setor_id = s.id AND l.ativo AND l.status = 'livre'
  WHERE s.unidade_id = p_unidade AND s.ativo AND s.tipo = 'observacao'
    AND s.publico IN ('todos', coalesce(p_publico, 'todos'))
  ORDER BY (l.id IS NULL), (s.publico = 'todos'), s.ordem, s.nome,
           length(l.identificador), l.identificador
  LIMIT 1
$$;

-- ── desfecho: agora abre o box ou o leito ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_desfecho(
  p_episodio uuid, p_desfecho text, p_relato text DEFAULT NULL, p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.episodios;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_etapa text;
  v_setor uuid;
  v_leito uuid;
  v_internacao uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'O episódio não está em atendimento.'; END IF;
  IF p_desfecho NOT IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito', 'observacao', 'internacao') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;

  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros WHERE episodio_id = e.id) THEN
    RAISE EXCEPTION 'Registre o atendimento (SOAP) antes do desfecho.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(btrim(coalesce(p_relato, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_desfecho = 'obito' THEN
    IF nullif(d ->> 'hora_obito', '') IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF (d ->> 'hora_obito')::timestamptz > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN RAISE EXCEPTION 'Informe o número da Declaração de Óbito.'; END IF;
  END IF;

  IF p_desfecho = 'observacao' THEN
    SELECT b.setor_id, b.leito_id INTO v_setor, v_leito FROM private.box_livre(e.unidade_id, e.publico) b;
    IF v_setor IS NULL THEN RAISE EXCEPTION 'A unidade não tem setor de Observação cadastrado.'; END IF;
    v_internacao := private.internar_do_episodio(e, 'em_observacao', v_setor, v_leito);
    INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, autor_id)
    VALUES (e.unidade_id, e.paciente_id, v_internacao, 'observacao',
            'Observação: definir conduta (alta ou internação) em até 6 horas.', now() + interval '6 hours',
            private.meu_perfil_id());
    d := d || jsonb_build_object('internacao_id', v_internacao, 'box', v_leito);
  ELSIF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = e.unidade_id
                                        AND ativo AND tipo IN ('internacao', 'uti', 'isolamento')) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status = 'livre') THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    v_internacao := private.internar_do_episodio(e, 'internado', v_setor, v_leito);
    d := d || jsonb_build_object('internacao_id', v_internacao);
  END IF;

  v_etapa := CASE p_desfecho WHEN 'observacao' THEN 'observacao' WHEN 'internacao' THEN 'internacao' ELSE 'encerrado' END;
  UPDATE public.episodios
     SET etapa = v_etapa,
         desfecho = p_desfecho,
         desfecho_motivo = nullif(btrim(p_relato), ''),
         desfecho_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END,
         desfecho_em = now(), desfecho_por = private.meu_perfil_id(),
         encerrado_em = CASE WHEN v_etapa = 'encerrado' THEN now() END,
         encerrado_por = CASE WHEN v_etapa = 'encerrado' THEN private.meu_perfil_id() END,
         updated_at = now()
   WHERE id = e.id;
  PERFORM private.registrar_auditoria('desfecho', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', v_etapa, 'tipo', p_desfecho));
END $$;
REVOKE ALL ON FUNCTION public.registrar_desfecho(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_desfecho(uuid, text, text, jsonb) TO authenticated;

-- ── a internação conduz o episódio ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.internacao_conduz_episodio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ativo boolean := NEW.status IN ('admitido', 'em_observacao', 'internado');
  v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  -- saiu da observação (para internação ou alta): a pendência de observação está resolvida
  IF OLD.status = 'em_observacao' AND NEW.status <> 'em_observacao' THEN
    UPDATE public.pendencias
       SET situacao = 'concluida', resolvida_em = now(), resolvida_por = v_perfil,
           motivo_resolucao = CASE WHEN NEW.status = 'internado' THEN 'Convertida em internação' ELSE 'Alta da observação' END
     WHERE internacao_id = NEW.id AND tipo = 'observacao' AND situacao = 'aberta';
  END IF;
  IF NOT v_ativo THEN
    -- alta: o que não impede a alta e ficou aberto é cancelado junto
    UPDATE public.pendencias
       SET situacao = 'cancelada', resolvida_em = now(), resolvida_por = v_perfil, motivo_resolucao = 'Encerrada com a alta'
     WHERE internacao_id = NEW.id AND situacao = 'aberta';
  END IF;
  IF NEW.episodio_id IS NOT NULL THEN
    UPDATE public.episodios
       SET etapa = CASE WHEN v_ativo THEN CASE WHEN NEW.status = 'em_observacao' THEN 'observacao' ELSE 'internacao' END ELSE 'encerrado' END,
           encerrado_em = CASE WHEN v_ativo THEN NULL ELSE coalesce(NEW.data_alta, now()) END,
           encerrado_por = CASE WHEN v_ativo THEN NULL ELSE v_perfil END,
           updated_at = now()
     WHERE id = NEW.episodio_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_internacao_conduz_episodio ON public.internacoes;
CREATE TRIGGER trg_internacao_conduz_episodio AFTER UPDATE OF status ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.internacao_conduz_episodio();

-- ── pendências: registrar, concluir, desfazer ───────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_pendencia(
  p_internacao uuid, p_tipo text, p_descricao text, p_prazo text DEFAULT 'sem_prazo', p_impeditiva boolean DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_prazo timestamptz;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  IF NOT (private.cuido_da_internacao(i) OR private.papel_na_unidade(i.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.';
  END IF;
  IF p_tipo NOT IN ('reavaliacao', 'exame', 'parecer', 'regulacao', 'outro') THEN RAISE EXCEPTION 'Tipo de pendência desconhecido.'; END IF;
  IF length(btrim(coalesce(p_descricao, ''))) < 3 THEN RAISE EXCEPTION 'Descreva a pendência.'; END IF;
  v_prazo := CASE p_prazo
    WHEN '1h' THEN now() + interval '1 hour'
    WHEN '2h' THEN now() + interval '2 hours'
    WHEN '4h' THEN now() + interval '4 hours'
    WHEN 'fim_plantao' THEN (SELECT max(p.inicio + make_interval(mins => p.duracao_min)) FROM private.plantoes_agora() p WHERE p.setor_id = i.setor_atual_id)
    WHEN 'sem_prazo' THEN NULL
    ELSE NULL END;
  IF p_prazo NOT IN ('1h', '2h', '4h', 'fim_plantao', 'sem_prazo') THEN RAISE EXCEPTION 'Prazo desconhecido.'; END IF;
  IF p_prazo = 'fim_plantao' AND v_prazo IS NULL THEN RAISE EXCEPTION 'Não há plantão em curso neste setor para usar como prazo.'; END IF;
  INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, impeditiva, autor_id)
  VALUES (i.unidade_id, i.paciente_id, i.id, p_tipo, btrim(p_descricao), v_prazo,
          coalesce(p_impeditiva, p_tipo = 'parecer'), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.concluir_pendencia(p_pendencia uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pe public.pendencias; i public.internacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pe FROM public.pendencias WHERE id = p_pendencia FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pendência não encontrada.'; END IF;
  SELECT * INTO i FROM public.internacoes WHERE id = pe.internacao_id;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF pe.tipo = 'observacao' THEN
    RAISE EXCEPTION 'A observação se resolve com a conduta: alta ou internação.';
  END IF;
  IF pe.situacao <> 'aberta' THEN RAISE EXCEPTION 'Pendência já resolvida.'; END IF;
  UPDATE public.pendencias
     SET situacao = 'concluida', resolvida_em = now(), resolvida_por = private.meu_perfil_id(),
         motivo_resolucao = nullif(btrim(p_motivo), '')
   WHERE id = pe.id;
END $$;

-- Desfazer: só quem concluiu, até 1 minuto depois (a tela dá 8 segundos).
CREATE OR REPLACE FUNCTION public.desfazer_pendencia(p_pendencia uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pe public.pendencias;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pe FROM public.pendencias WHERE id = p_pendencia FOR UPDATE;
  IF NOT FOUND OR pe.situacao <> 'concluida' OR pe.resolvida_por IS DISTINCT FROM private.meu_perfil_id()
     OR pe.resolvida_em < now() - interval '1 minute' OR pe.tipo = 'observacao' THEN
    RAISE EXCEPTION 'Não é mais possível desfazer.';
  END IF;
  UPDATE public.pendencias SET situacao = 'aberta', resolvida_em = NULL, resolvida_por = NULL, motivo_resolucao = NULL
   WHERE id = pe.id;
END $$;

REVOKE ALL ON FUNCTION public.registrar_pendencia(uuid, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.concluir_pendencia(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desfazer_pendencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pendencia(uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_pendencia(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_pendencia(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.internar_do_episodio(public.episodios, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.box_livre(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── mudar de setor/leito libera o box ou leito anterior ─────────────────────
-- A transferência (inclusive observação → internação) não liberava o leito de
-- origem, e o paciente ficava com o box da Observação. Leito fora do setor
-- novo sai da internação; o que ficou para trás vai para higienização.
CREATE OR REPLACE FUNCTION private.internacao_troca_leito() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status NOT IN ('admitido', 'em_observacao', 'internado') OR OLD.leito_atual_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.leito_atual_id = OLD.leito_atual_id AND NEW.setor_atual_id IS DISTINCT FROM OLD.setor_atual_id
     AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = NEW.leito_atual_id AND setor_id = NEW.setor_atual_id) THEN
    NEW.leito_atual_id := NULL;
  END IF;
  IF NEW.leito_atual_id IS DISTINCT FROM OLD.leito_atual_id THEN
    UPDATE public.leitos SET status = 'higienizacao' WHERE id = OLD.leito_atual_id AND status = 'ocupado';
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    SELECT OLD.leito_atual_id, NEW.unidade_id, 'liberacao', 'ocupado', 'higienizacao', NEW.id, p, 'Transferência liberou o leito'
      FROM private.meu_perfil_id() p WHERE p IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_internacao_troca_leito ON public.internacoes;
CREATE TRIGGER trg_internacao_troca_leito BEFORE UPDATE OF leito_atual_id, setor_atual_id ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.internacao_troca_leito();
