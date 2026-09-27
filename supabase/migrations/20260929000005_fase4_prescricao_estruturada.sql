-- Fase 4.4 — prescrição estruturada.
--
--  * Item ligado ao medicamento do cadastro; dose, via e frequência escritas
--    pelo médico (nenhuma dose sugerida — decisão do usuário em 27/09/2026:
--    o catálogo fixo perdeu as doses).
--  * Nada é apagado: item suspenso ganha suspenso_em, com motivo. A
--    prescrição de qualquer instante é reconstruída (prescricao_vigente).
--  * Pediatria (< 14 anos): peso aferido no episódio é obrigatório antes de
--    prescrever medicamento; o peso de referência fica gravado no item.
--  * Alergia registrada trava o item (não o resto da prescrição) — e nada a
--    contorna (protótipo, D6).
--  * O item guarda a diluição VIGENTE naquele momento (versão e texto); se o
--    médico diverge do padrão, só com justificativa (≥ 10 letras).
--  * Medicamentos vasoativos marcados pelo cadastro (lista da nota "d" do
--    Phoenix, JAMA 2024: adrenalina, noradrenalina, dopamina, dobutamina,
--    milrinona, vasopressina) — alimentam o Phoenix na 4.6.
--  * Vale para a internação e, sem internação, para o episódio da porta.

-- calculada do nome: medicamento cadastrado depois também ganha a marca
ALTER TABLE public.medicamento DROP COLUMN IF EXISTS vasoativo;
ALTER TABLE public.medicamento ADD COLUMN vasoativo boolean GENERATED ALWAYS AS (
  principio_ativo_norm ~ '(^|[^a-z])(adrenalina|epinefrina|noradrenalina|norepinefrina|dopamina|dobutamina|milrinona|vasopressina)($|[^a-z])') STORED;

-- ── alergias do paciente ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alergias_paciente (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  substancia      text NOT NULL,
  substancia_norm text NOT NULL,
  reacao          text,
  registrado_por  uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em   timestamptz NOT NULL DEFAULT now(),
  inativada_em    timestamptz,
  inativada_por   uuid REFERENCES public.perfis(id),
  motivo_inativacao text
);
CREATE INDEX IF NOT EXISTS alergias_paciente_idx ON public.alergias_paciente (paciente_id) WHERE inativada_em IS NULL;
ALTER TABLE public.alergias_paciente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alergias_select ON public.alergias_paciente;
CREATE POLICY alergias_select ON public.alergias_paciente FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS alergias_segundo_fator ON public.alergias_paciente;
CREATE POLICY alergias_segundo_fator ON public.alergias_paciente AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok());
REVOKE INSERT, UPDATE, DELETE ON public.alergias_paciente FROM anon, authenticated;
GRANT SELECT ON public.alergias_paciente TO authenticated;

CREATE OR REPLACE FUNCTION private.norm(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT lower(btrim(terminologia.unaccent_text(coalesce(p, '')))) $$;

CREATE OR REPLACE FUNCTION public.registrar_alergia(p_paciente uuid, p_substancia text, p_reacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF length(private.norm(p_substancia)) < 3 THEN RAISE EXCEPTION 'Informe a substância.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  SELECT id INTO v_id FROM public.alergias_paciente
   WHERE paciente_id = p_paciente AND substancia_norm = private.norm(p_substancia) AND inativada_em IS NULL;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, reacao, registrado_por)
  VALUES (v_unidade, p_paciente, btrim(p_substancia), private.norm(p_substancia), nullif(btrim(p_reacao), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.inativar_alergia(p_alergia uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.alergias_paciente;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.alergias_paciente WHERE id = p_alergia FOR UPDATE;
  IF NOT FOUND OR a.inativada_em IS NOT NULL THEN RAISE EXCEPTION 'Alergia não encontrada.'; END IF;
  IF private.pode_atuar_no_paciente(a.paciente_id) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga por que a alergia deixa de valer (mínimo de 10 letras).'; END IF;
  UPDATE public.alergias_paciente SET inativada_em = now(), inativada_por = private.meu_perfil_id(), motivo_inativacao = btrim(p_motivo)
   WHERE id = a.id;
END $$;

REVOKE ALL ON FUNCTION public.registrar_alergia(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inativar_alergia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_alergia(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inativar_alergia(uuid, text) TO authenticated;

-- ── prescrição: cabeçalho por internação ou episódio; itens que não somem ────
ALTER TABLE public.prescricoes
  ADD COLUMN IF NOT EXISTS internacao_id uuid REFERENCES public.internacoes(id),
  ADD COLUMN IF NOT EXISTS episodio_id uuid REFERENCES public.episodios(id);
ALTER TABLE public.prescricao_itens
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'medicamento' CHECK (tipo IN ('medicamento', 'cuidado')),
  ADD COLUMN IF NOT EXISTS via text,
  ADD COLUMN IF NOT EXISTS se_necessario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS peso_kg numeric,
  ADD COLUMN IF NOT EXISTS diluicao_id uuid REFERENCES public.diluicao(id),
  ADD COLUMN IF NOT EXISTS diluicao_versao int,
  ADD COLUMN IF NOT EXISTS diluicao_texto text,
  ADD COLUMN IF NOT EXISTS diluicao_divergente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justificativa_divergencia text,
  ADD COLUMN IF NOT EXISTS autor_id uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS suspenso_em timestamptz,
  ADD COLUMN IF NOT EXISTS suspenso_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS motivo_suspensao text;
CREATE INDEX IF NOT EXISTS prescricao_itens_ativos ON public.prescricao_itens (prescricao_id) WHERE suspenso_em IS NULL;

-- a prescrição ativa do paciente: da internação ativa, senão do episódio aberto
CREATE OR REPLACE FUNCTION private.prescricao_do_paciente(p_paciente uuid, p_criar boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_int uuid; v_ep uuid; v_id uuid; v_unidade uuid;
BEGIN
  SELECT id INTO v_int FROM public.internacoes WHERE paciente_id = p_paciente AND status IN ('admitido', 'em_observacao', 'internado') LIMIT 1;
  v_ep := private.episodio_aberto(p_paciente);
  IF v_int IS NULL AND v_ep IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.prescricoes
   WHERE paciente_id = p_paciente AND status = 'ativa'
     AND (internacao_id = v_int OR (v_int IS NULL AND internacao_id IS NULL AND episodio_id = v_ep))
   ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL OR NOT p_criar THEN RETURN v_id; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status, internacao_id, episodio_id, criada_por)
  VALUES (v_unidade, p_paciente, private.meu_perfil_id(), 'ativa', v_int, v_ep, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- item: {tipo, medicamento_id, descricao, dose, via, posologia, se_necessario,
--        observacao, diluicao_divergente (texto), justificativa_divergencia}
CREATE OR REPLACE FUNCTION public.prescrever(p_paciente uuid, p_item jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_presc uuid; v_unidade uuid; v_nasc date; v_peso numeric; v_desde timestamptz; v_id uuid;
  v_tipo text := coalesce(p_item ->> 'tipo', 'medicamento');
  m public.medicamento; dv record; al record;
  v_dil_id uuid; v_dil_versao int; v_dil_texto text;
  v_via text := upper(nullif(btrim(p_item ->> 'via'), ''));
  v_dil_div text := nullif(btrim(p_item ->> 'diluicao_divergente'), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT private.paciente_no_meu_plantao(p_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A prescrição é do médico de plantão no setor do paciente.';
  END IF;

  IF v_tipo = 'cuidado' THEN
    IF length(btrim(coalesce(p_item ->> 'descricao', ''))) < 3 THEN RAISE EXCEPTION 'Descreva o cuidado.'; END IF;
  ELSIF v_tipo = 'medicamento' THEN
    SELECT * INTO m FROM public.medicamento WHERE id = nullif(p_item ->> 'medicamento_id', '')::uuid AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'dose', ''))) = 0 THEN RAISE EXCEPTION 'Informe a dose.'; END IF;
    IF v_via IS NULL THEN RAISE EXCEPTION 'Informe a via.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'posologia', ''))) = 0 THEN RAISE EXCEPTION 'Informe a frequência.'; END IF;
    -- alergia trava o item (e nada a contorna)
    SELECT substancia INTO al FROM public.alergias_paciente a
     WHERE a.paciente_id = p_paciente AND a.inativada_em IS NULL
       AND (m.principio_ativo_norm LIKE '%' || a.substancia_norm || '%' OR a.substancia_norm LIKE '%' || m.principio_ativo_norm || '%')
     LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'ALERGIA: o paciente tem alergia registrada a "%". Este item não foi prescrito.', al.substancia;
    END IF;
    -- pediatria: peso aferido no episódio
    IF v_nasc IS NOT NULL AND v_nasc > current_date - interval '14 years' THEN
      SELECT coalesce((SELECT chegada_em FROM public.episodios WHERE id = private.episodio_aberto(p_paciente)), now() - interval '24 hours') INTO v_desde;
      SELECT o.valor_num INTO v_peso FROM public.observacao o
        JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
       WHERE o.paciente_id = p_paciente AND o.aferido_em >= v_desde AND o.valor_num > 0
       ORDER BY o.aferido_em DESC LIMIT 1;
      IF v_peso IS NULL THEN RAISE EXCEPTION 'Criança: registre o peso aferido neste atendimento antes de prescrever medicamento.'; END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de item desconhecido.';
  END IF;

  v_presc := private.prescricao_do_paciente(p_paciente, true);
  IF v_presc IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto nem internação ativa.'; END IF;
  IF v_tipo = 'medicamento' AND EXISTS (
       SELECT 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc AND medicamento_id = m.id AND upper(via) = v_via AND suspenso_em IS NULL) THEN
    RAISE EXCEPTION 'Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.';
  END IF;

  -- diluição vigente agora (a da unidade tem preferência)
  IF v_tipo = 'medicamento' THEN
    SELECT * INTO dv FROM public.diluicao_vigente(m.id, v_via, now(), v_unidade);
    IF FOUND THEN v_dil_id := dv.id; v_dil_versao := dv.versao; v_dil_texto := dv.texto; END IF;
    IF v_dil_div IS NOT NULL AND length(btrim(coalesce(p_item ->> 'justificativa_divergencia', ''))) < 10 THEN
      RAISE EXCEPTION 'Diluição diferente do padrão só com justificativa (mínimo de 10 letras).';
    END IF;
  END IF;

  INSERT INTO public.prescricao_itens (prescricao_id, medicamento_id, descricao, dose, via, posologia, se_necessario, observacao,
    tipo, peso_kg, diluicao_id, diluicao_versao, diluicao_texto, diluicao_divergente, justificativa_divergencia, autor_id, ordem)
  VALUES (v_presc, m.id,
          CASE WHEN v_tipo = 'cuidado' THEN btrim(p_item ->> 'descricao') ELSE m.principio_ativo || coalesce(' ' || m.apresentacao, '') END,
          nullif(btrim(p_item ->> 'dose'), ''), v_via, nullif(btrim(p_item ->> 'posologia'), ''),
          coalesce((p_item ->> 'se_necessario')::boolean, false), nullif(btrim(p_item ->> 'observacao'), ''),
          v_tipo, v_peso, v_dil_id, v_dil_versao, coalesce(v_dil_div, v_dil_texto), v_dil_div IS NOT NULL,
          CASE WHEN v_dil_div IS NOT NULL THEN btrim(p_item ->> 'justificativa_divergencia') END,
          private.meu_perfil_id(),
          coalesce((SELECT max(ordem) + 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc), 1))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.suspender_item(p_item uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item FOR UPDATE;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou já suspenso.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.paciente_no_meu_plantao(pr.paciente_id) OR private.tenho_papel(pr.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Suspender é do médico de plantão no setor do paciente.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Diga por que suspende.'; END IF;
  UPDATE public.prescricao_itens SET suspenso_em = now(), suspenso_por = private.meu_perfil_id(), motivo_suspensao = btrim(p_motivo)
   WHERE id = it.id;
END $$;

-- a prescrição como estava num instante (padrão: agora)
CREATE OR REPLACE FUNCTION public.prescricao_vigente(p_paciente uuid, p_em timestamptz DEFAULT now())
RETURNS TABLE (id uuid, tipo text, descricao text, medicamento_id uuid, dose text, via text, posologia text, se_necessario boolean,
               observacao text, peso_kg numeric, diluicao_versao int, diluicao_texto text, diluicao_divergente boolean,
               justificativa_divergencia text, vasoativo boolean, autor text, criado_em timestamptz, suspenso_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_presc uuid;
BEGIN
  IF NOT (private.paciente_no_meu_plantao(p_paciente)
          OR private.papel_na_unidade((SELECT unidade_id FROM public.pacientes WHERE pacientes.id = p_paciente)) = 'gestor'
          OR private.sou_farmaceutico()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  v_presc := private.prescricao_do_paciente(p_paciente, false);
  RETURN QUERY
  SELECT i.id, i.tipo, i.descricao, i.medicamento_id, i.dose, i.via, i.posologia, i.se_necessario, i.observacao, i.peso_kg,
         i.diluicao_versao, i.diluicao_texto, i.diluicao_divergente, i.justificativa_divergencia,
         coalesce(m.vasoativo, false), pf.nome_completo, i.created_at, i.suspenso_em
  FROM public.prescricao_itens i
  LEFT JOIN public.medicamento m ON m.id = i.medicamento_id
  LEFT JOIN public.perfis pf ON pf.id = i.autor_id
  WHERE i.prescricao_id = v_presc AND i.created_at <= p_em AND (i.suspenso_em IS NULL OR i.suspenso_em > p_em)
  ORDER BY i.ordem;
END $$;

REVOKE ALL ON FUNCTION public.prescrever(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suspender_item(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prescricao_vigente(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prescrever(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspender_item(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prescricao_vigente(uuid, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION private.prescricao_do_paciente(uuid, boolean) FROM PUBLIC, anon, authenticated;
