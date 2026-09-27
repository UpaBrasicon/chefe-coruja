-- ════════════════════════════════════════════════════════════════════════════
-- Fase 2.4 — atendimento médico no Pronto Socorro e desfecho (CONTEXT.md:
-- Atendimento, Desfecho).
--
-- • Abrir o atendimento marca o médico e a hora (a espera da fila acaba aí) e
--   abre o prontuário (consulta registrada pelo servidor).
-- • SOAP: cada registro é novo (só inserção), com autor do login; corrigir é
--   escrever outro. Lido só com prontuário aberto.
-- • Desfecho pelo médico, com as regras do protótipo:
--     transferência → destino;  óbito → hora e nº da Declaração de Óbito;
--     evasão, alta a pedido e óbito → relato;
--     todo desfecho, exceto evasão, exige ao menos um SOAP.
--   Observação e internação passam o episódio para a Fase 3 (box / leito);
--   os demais encerram o episódio.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.episodios
  ADD COLUMN IF NOT EXISTS atendimento_medico_id uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS desfecho_em timestamptz,
  ADD COLUMN IF NOT EXISTS desfecho_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS desfecho_detalhes jsonb;

-- ── SOAP ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atendimento_registros (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episodio_id  uuid NOT NULL REFERENCES public.episodios(id),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  subjetivo    text,
  objetivo     text,
  avaliacao    text,
  cid          text CHECK (cid IS NULL OR cid ~ '^[A-Z][0-9]{2}(\.?[0-9A-Z])?$'),
  plano        text,
  autor_id     uuid NOT NULL REFERENCES public.perfis(id),
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CHECK (coalesce(btrim(subjetivo), '') <> '' OR coalesce(btrim(objetivo), '') <> ''
         OR coalesce(btrim(avaliacao), '') <> '' OR coalesce(btrim(plano), '') <> '')
);
CREATE INDEX IF NOT EXISTS atendimento_registros_episodio ON public.atendimento_registros (episodio_id, criado_em);
DROP TRIGGER IF EXISTS trg_atendimento_registros_so_insercao ON public.atendimento_registros;
CREATE TRIGGER trg_atendimento_registros_so_insercao BEFORE UPDATE OR DELETE ON public.atendimento_registros
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

ALTER TABLE public.atendimento_registros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atendimento_registros FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.atendimento_registros FROM authenticated;
GRANT SELECT ON public.atendimento_registros TO authenticated;
DROP POLICY IF EXISTS atendimento_registros_select ON public.atendimento_registros;
CREATE POLICY atendimento_registros_select ON public.atendimento_registros FOR SELECT TO authenticated
USING (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = episodio_id
             AND e.setor_id IN (SELECT private.setores_na_escala_agora()))
);
DROP POLICY IF EXISTS atendimento_registros_prontuario_aberto ON public.atendimento_registros;
CREATE POLICY atendimento_registros_prontuario_aberto ON public.atendimento_registros AS RESTRICTIVE FOR SELECT TO authenticated
  USING (private.prontuario_aberto(paciente_id));
DROP POLICY IF EXISTS atendimento_registros_segundo_fator ON public.atendimento_registros;
CREATE POLICY atendimento_registros_segundo_fator ON public.atendimento_registros AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- ── guarda comum: médico de plantão na porta do episódio ────────────────────
CREATE OR REPLACE FUNCTION private.medico_na_porta(e public.episodios) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O atendimento é do médico.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.medico_na_porta(public.episodios) FROM PUBLIC, anon, authenticated;

-- ── abrir o atendimento ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.iniciar_atendimento(p_episodio uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.episodios;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'O paciente não está aguardando atendimento médico.'; END IF;
  IF e.atendimento_iniciado_em IS NULL THEN
    UPDATE public.episodios
       SET atendimento_medico_id = private.meu_perfil_id(), atendimento_iniciado_em = now(), updated_at = now()
     WHERE id = e.id;
    PERFORM private.registrar_auditoria('iniciar_atendimento', 'episodios', e.id, e.unidade_id,
      jsonb_build_object('status', 'em_atendimento'));
  END IF;
  -- abrir o atendimento é abrir o prontuário: consulta registrada no servidor
  PERFORM public.abrir_prontuario(e.paciente_id);
END $$;
REVOKE ALL ON FUNCTION public.iniciar_atendimento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_atendimento(uuid) TO authenticated;

-- ── SOAP ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_soap(
  p_episodio uuid, p_subjetivo text, p_objetivo text, p_avaliacao text, p_plano text, p_cid text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.episodios; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' OR e.atendimento_iniciado_em IS NULL THEN
    RAISE EXCEPTION 'Abra o atendimento antes de registrar.';
  END IF;
  INSERT INTO public.atendimento_registros (episodio_id, unidade_id, paciente_id, subjetivo, objetivo, avaliacao, cid, plano, autor_id)
  VALUES (e.id, e.unidade_id, e.paciente_id, nullif(btrim(p_subjetivo), ''), nullif(btrim(p_objetivo), ''),
          nullif(btrim(p_avaliacao), ''), nullif(upper(btrim(p_cid)), ''), nullif(btrim(p_plano), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_soap(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_soap(uuid, text, text, text, text, text) TO authenticated;

-- ── desfecho ────────────────────────────────────────────────────────────────
ALTER TABLE public.episodios DROP CONSTRAINT IF EXISTS episodios_desfecho_valido;
ALTER TABLE public.episodios ADD CONSTRAINT episodios_desfecho_valido CHECK (desfecho IS NULL OR desfecho IN (
  'alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito', 'observacao', 'internacao', 'cancelado'));

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

-- Depois que o médico abriu o atendimento, sair da fila não é mais "retirar":
-- é desfecho (evasão), registrado pelo médico.
CREATE OR REPLACE FUNCTION private.fila_sem_atendimento_aberto() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.atendimento_iniciado_em IS NOT NULL AND NEW.desfecho_por IS NULL AND NEW.etapa = 'encerrado' THEN
    RAISE EXCEPTION 'Atendimento já aberto: registre o desfecho (evasão) pelo médico.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fila_sem_atendimento_aberto ON public.episodios;
CREATE TRIGGER trg_fila_sem_atendimento_aberto BEFORE UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.fila_sem_atendimento_aberto();
