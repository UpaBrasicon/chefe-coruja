-- Fase 4.5 — diluição padrão versionada, com vigência, publicada pelo farmacêutico.
--
-- Decisão do usuário (27/09/2026): o farmacêutico da unidade revisa e publica;
-- o HU-UFGD v3 fica só como rascunho de partida. Regras do protótipo:
--  * sem CRF do revisor não publica; via EV sem volume mínimo e sem tempo de
--    infusão não publica;
--  * publicar substitui a referência que chega ao médico, mas o padrão anterior
--    fica visível (vira "substituido", com vigente_ate) — nunca é apagado nem
--    editado depois de publicado;
--  * a prescrição guarda a versão vigente no momento (4.4): "uma prescrição de
--    janeiro continua mostrando a diluição de janeiro".

ALTER TABLE public.diluicao
  ADD COLUMN IF NOT EXISTS versao int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vigente_desde timestamptz,
  ADD COLUMN IF NOT EXISTS vigente_ate timestamptz,
  ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id),
  ADD COLUMN IF NOT EXISTS publicado_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS publicado_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_id uuid REFERENCES public.diluicao(id),
  ADD COLUMN IF NOT EXISTS motivo_alteracao text;

-- as já publicadas viram a versão 1, vigente desde a revisão (ou do cadastro)
UPDATE public.diluicao
   SET vigente_desde = coalesce(data_revisao::timestamptz, created_at), publicado_em = coalesce(publicado_em, updated_at)
 WHERE status = 'publicado' AND vigente_desde IS NULL;

ALTER TABLE public.diluicao DROP CONSTRAINT IF EXISTS diluicao_status_valido;
ALTER TABLE public.diluicao ADD CONSTRAINT diluicao_status_valido
  CHECK (status IN ('rascunho', 'revisado', 'publicado', 'substituido', 'descartado'));

-- publicada não se edita: só pode ganhar vigente_ate e virar "substituido"
CREATE OR REPLACE FUNCTION private.diluicao_publicada_imutavel() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status IN ('publicado', 'substituido') THEN
    IF (to_jsonb(NEW) - ARRAY['vigente_ate', 'status', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['vigente_ate', 'status', 'updated_at'])
       OR NOT (NEW.status = OLD.status OR (OLD.status = 'publicado' AND NEW.status = 'substituido')) THEN
      RAISE EXCEPTION 'Diluição publicada não se edita: crie uma nova versão.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_diluicao_imutavel ON public.diluicao;
CREATE TRIGGER trg_diluicao_imutavel BEFORE UPDATE ON public.diluicao
  FOR EACH ROW EXECUTE FUNCTION private.diluicao_publicada_imutavel();
DROP TRIGGER IF EXISTS trg_diluicao_sem_delete ON public.diluicao;
CREATE TRIGGER trg_diluicao_sem_delete BEFORE DELETE ON public.diluicao
  FOR EACH ROW WHEN (OLD.status IN ('publicado', 'substituido')) EXECUTE FUNCTION private.so_insercao();

-- quem é farmacêutico em alguma unidade vê também os rascunhos
CREATE OR REPLACE FUNCTION private.sou_farmaceutico() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = private.meu_perfil_id() AND v.ativo AND v.papel = 'farmaceutico')
$$;
DROP POLICY IF EXISTS diluicao_select_publicado ON public.diluicao;
CREATE POLICY diluicao_select_publicado ON public.diluicao FOR SELECT TO authenticated
  USING (status IN ('publicado', 'substituido') OR private.eh_super_admin() OR private.sou_farmaceutico());

-- texto de uma diluição, do jeito que vai para a prescrição e para o papel
CREATE OR REPLACE FUNCTION private.diluicao_texto(d public.diluicao) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT concat_ws('; ',
    CASE WHEN d.reconstituicao_diluente IS NOT NULL THEN 'Reconstituir em ' || coalesce(d.reconstituicao_volume_ml::text || ' mL de ', '') || d.reconstituicao_diluente END,
    CASE WHEN d.diluicao_solucao IS NOT NULL AND cardinality(d.diluicao_solucao) > 0 THEN
      'Diluir em ' || array_to_string(d.diluicao_solucao, ' ou ') || coalesce(' (mín. ' || d.diluicao_volume_min_ml::text || ' mL)', '') END,
    CASE WHEN d.concentracao_maxima IS NOT NULL THEN 'conc. máx. ' || d.concentracao_maxima END,
    CASE WHEN d.tempo_infusao_min IS NOT NULL THEN 'infundir em ' || d.tempo_infusao_min || ' min' END,
    CASE WHEN d.bolus_permitido IS FALSE THEN 'não fazer em bolus' END,
    CASE WHEN d.acesso IS NOT NULL THEN 'acesso ' || d.acesso END)
$$;

-- a diluição que valia num instante (a da unidade tem preferência sobre a geral)
CREATE OR REPLACE FUNCTION public.diluicao_vigente(p_medicamento uuid, p_via text, p_em timestamptz DEFAULT now(), p_unidade uuid DEFAULT NULL)
RETURNS TABLE (id uuid, versao int, vigente_desde timestamptz, vigente_ate timestamptz, texto text, fonte text, revisor_crf text, unidade_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.id, d.versao, d.vigente_desde, d.vigente_ate, private.diluicao_texto(d), d.fonte, d.revisor_crf, d.unidade_id
  FROM public.diluicao d
  WHERE d.medicamento_id = p_medicamento AND upper(d.via) = upper(p_via)
    AND d.status IN ('publicado', 'substituido')
    AND d.vigente_desde <= p_em AND (d.vigente_ate IS NULL OR d.vigente_ate > p_em)
    AND (d.unidade_id IS NULL OR d.unidade_id = p_unidade)
  ORDER BY (d.unidade_id IS NOT NULL) DESC, d.vigente_desde DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.diluicao_vigente(uuid, text, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diluicao_vigente(uuid, text, timestamptz, uuid) TO authenticated;

-- ── farmacêutico: rascunho e publicação ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.salvar_diluicao(p_id uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diluicao; v_id uuid; m public.medicamento;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.sou_farmaceutico() OR private.eh_super_admin()) THEN RAISE EXCEPTION 'Diluição é do farmacêutico.'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO d FROM public.diluicao WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Diluição não encontrada.'; END IF;
  END IF;
  IF p_id IS NULL OR d.status IN ('publicado', 'substituido') THEN
    -- nova linha: do zero ou nova versão a partir da publicada
    IF p_id IS NULL THEN
      SELECT * INTO m FROM public.medicamento WHERE id = (p_dados ->> 'medicamento_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
      IF nullif(btrim(p_dados ->> 'via'), '') IS NULL THEN RAISE EXCEPTION 'Informe a via.'; END IF;
      INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, fonte, status)
      VALUES (m.id, m.principio_ativo, coalesce(m.apresentacao, ''), upper(btrim(p_dados ->> 'via')),
              coalesce(nullif(btrim(p_dados ->> 'fonte'), ''), 'a definir'), 'rascunho')
      RETURNING id INTO v_id;
    ELSE
      INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
        reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
        bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
        incompatibilidades, alta_vigilancia, observacoes, fonte, data_revisao, revisor_crf, status, versao, unidade_id, origem_id)
      SELECT medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
        reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
        bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
        incompatibilidades, alta_vigilancia, observacoes, fonte, NULL, NULL, 'rascunho', versao + 1, unidade_id, id
      FROM public.diluicao WHERE id = p_id
      RETURNING id INTO v_id;
    END IF;
  ELSE
    v_id := p_id;
  END IF;
  -- campos editáveis do rascunho
  UPDATE public.diluicao SET
    reconstituicao_diluente = CASE WHEN p_dados ? 'reconstituicao_diluente' THEN nullif(btrim(p_dados ->> 'reconstituicao_diluente'), '') ELSE reconstituicao_diluente END,
    reconstituicao_volume_ml = CASE WHEN p_dados ? 'reconstituicao_volume_ml' THEN nullif(p_dados ->> 'reconstituicao_volume_ml', '')::numeric ELSE reconstituicao_volume_ml END,
    reconstituicao_concentracao = CASE WHEN p_dados ? 'reconstituicao_concentracao' THEN nullif(btrim(p_dados ->> 'reconstituicao_concentracao'), '') ELSE reconstituicao_concentracao END,
    diluicao_solucao = CASE WHEN p_dados ? 'diluicao_solucao' THEN ARRAY(SELECT jsonb_array_elements_text(p_dados -> 'diluicao_solucao')) ELSE diluicao_solucao END,
    diluicao_volume_min_ml = CASE WHEN p_dados ? 'diluicao_volume_min_ml' THEN nullif(p_dados ->> 'diluicao_volume_min_ml', '')::numeric ELSE diluicao_volume_min_ml END,
    concentracao_maxima = CASE WHEN p_dados ? 'concentracao_maxima' THEN nullif(btrim(p_dados ->> 'concentracao_maxima'), '') ELSE concentracao_maxima END,
    tempo_infusao_min = CASE WHEN p_dados ? 'tempo_infusao_min' THEN nullif(p_dados ->> 'tempo_infusao_min', '')::int ELSE tempo_infusao_min END,
    velocidade_max = CASE WHEN p_dados ? 'velocidade_max' THEN nullif(btrim(p_dados ->> 'velocidade_max'), '') ELSE velocidade_max END,
    bolus_permitido = CASE WHEN p_dados ? 'bolus_permitido' THEN (p_dados ->> 'bolus_permitido')::boolean ELSE bolus_permitido END,
    estabilidade_ta_h = CASE WHEN p_dados ? 'estabilidade_ta_h' THEN nullif(p_dados ->> 'estabilidade_ta_h', '')::numeric ELSE estabilidade_ta_h END,
    estabilidade_refrig_h = CASE WHEN p_dados ? 'estabilidade_refrig_h' THEN nullif(p_dados ->> 'estabilidade_refrig_h', '')::numeric ELSE estabilidade_refrig_h END,
    fotossensivel = CASE WHEN p_dados ? 'fotossensivel' THEN (p_dados ->> 'fotossensivel')::boolean ELSE fotossensivel END,
    acesso = CASE WHEN p_dados ? 'acesso' THEN nullif(btrim(p_dados ->> 'acesso'), '') ELSE acesso END,
    observacoes = CASE WHEN p_dados ? 'observacoes' THEN nullif(btrim(p_dados ->> 'observacoes'), '') ELSE observacoes END,
    fonte = CASE WHEN p_dados ? 'fonte' THEN coalesce(nullif(btrim(p_dados ->> 'fonte'), ''), fonte) ELSE fonte END,
    revisor_crf = CASE WHEN p_dados ? 'revisor_crf' THEN nullif(btrim(p_dados ->> 'revisor_crf'), '') ELSE revisor_crf END,
    motivo_alteracao = CASE WHEN p_dados ? 'motivo_alteracao' THEN nullif(btrim(p_dados ->> 'motivo_alteracao'), '') ELSE motivo_alteracao END
  WHERE id = v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.publicar_diluicao_versao(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diluicao; v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_farmaceutico() THEN RAISE EXCEPTION 'Publicar diluição é do farmacêutico.'; END IF;
  SELECT * INTO d FROM public.diluicao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.status NOT IN ('rascunho', 'revisado') THEN RAISE EXCEPTION 'Só se publica rascunho.'; END IF;
  IF d.medicamento_id IS NULL THEN RAISE EXCEPTION 'Ligue a diluição a um medicamento do cadastro antes de publicar.'; END IF;
  IF nullif(btrim(d.revisor_crf), '') IS NULL THEN RAISE EXCEPTION 'Sem o CRF do revisor não publica.'; END IF;
  IF nullif(btrim(d.fonte), '') IS NULL OR d.fonte = 'a definir' THEN RAISE EXCEPTION 'Informe a fonte da diluição.'; END IF;
  IF upper(d.via) = 'EV' AND (d.diluicao_volume_min_ml IS NULL OR d.tempo_infusao_min IS NULL) THEN
    RAISE EXCEPTION 'Via EV: sem volume mínimo e tempo de infusão não publica.';
  END IF;
  IF d.origem_id IS NOT NULL AND length(btrim(coalesce(d.motivo_alteracao, ''))) < 10 THEN
    RAISE EXCEPTION 'Nova versão: diga o que mudou (mínimo de 10 letras).';
  END IF;
  -- a vigente do mesmo medicamento, via e abrangência deixa de valer agora
  UPDATE public.diluicao SET vigente_ate = now(), status = 'substituido'
   WHERE medicamento_id = d.medicamento_id AND upper(via) = upper(d.via) AND unidade_id IS NOT DISTINCT FROM d.unidade_id
     AND status = 'publicado' AND id <> d.id;
  UPDATE public.diluicao
     SET status = 'publicado', vigente_desde = now(), publicado_em = now(), publicado_por = v_perfil, data_revisao = current_date
   WHERE id = d.id;
  PERFORM private.registrar_auditoria('publicar_diluicao', 'diluicao', d.id, NULL,
    jsonb_build_object('medicamento', d.principio_ativo, 'via', d.via, 'versao', d.versao));
END $$;

REVOKE ALL ON FUNCTION public.salvar_diluicao(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publicar_diluicao_versao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_diluicao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_diluicao_versao(uuid) TO authenticated;
