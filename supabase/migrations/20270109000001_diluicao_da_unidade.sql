-- Telas do farmacêutico, ponto 2 (pedido do RT em 27/10/2026, aprovado no mesmo
-- dia; docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md). Achado do diagnóstico: a
-- "Nova diluição" criava a linha sem unidade (modelo da rede), e qualquer
-- farmacêutico de qualquer unidade a publicava para todas.
--
-- Decisão do RT em 27/10/2026: o modelo da rede (diluicao.unidade_id nulo) só
-- é criado, mudado e publicado pelo SUPER ADMIN, por carga revisada como a do
-- HU-UFGD. O farmacêutico cria e publica só a diluição da unidade dele ("Nova
-- diluição" e "Ajustar esta linha").
--
-- Como fica:
--   • pode_editar_diluicao(NULL) passa a ser só o super admin (era qualquer
--     farmacêutico). Vale para salvar, criar versão e publicar a linha da rede.
--   • salvar_diluicao: a diluição nova recebe p_dados.unidade_id; sem ele, só o
--     super admin cria (modelo da rede). Com ele, só o farmacêutico daquela
--     unidade. O resto do corpo não muda.
--   • publicar_diluicao_versao aceita o super admin (para o modelo da rede); o
--     resto do corpo não muda.
-- As linhas que já existem não mudam. Rascunho da rede aberto por farmacêutico
-- fica parado até o super admin publicar ou a farmácia refazer como da unidade.
--
-- ORDEM NA PRODUÇÃO: publicar o frontend antes desta migration. O frontend
-- novo manda unidade_id; o banco antigo ignora a chave e segue como hoje. Já o
-- frontend antigo com o banco novo recusaria a "Nova diluição" (sem unidade).
--
-- ROLLBACK: reaplicar private.pode_editar_diluicao, public.salvar_diluicao e
--   public.publicar_diluicao_versao de 20261009000001. As linhas criadas como
--   da unidade continuam da unidade (é o comportamento novo desejado).

CREATE OR REPLACE FUNCTION private.pode_editar_diluicao(p_unidade uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p_unidade IS NULL THEN private.eh_super_admin()
              ELSE private.farmaceutico_da(p_unidade) END
$$;

CREATE OR REPLACE FUNCTION public.salvar_diluicao(p_id uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diluicao; v_id uuid; m public.medicamento; v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.sou_farmaceutico() OR private.eh_super_admin()) THEN RAISE EXCEPTION 'Diluição é do farmacêutico.'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO d FROM public.diluicao WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Diluição não encontrada.'; END IF;
    IF NOT private.pode_editar_diluicao(d.unidade_id) THEN
      RAISE EXCEPTION '%', CASE WHEN d.unidade_id IS NULL
        THEN 'Esta linha é do modelo da rede: só o super admin a muda. Para a sua unidade, use "Ajustar esta linha".'
        ELSE 'Esta linha é do padrão de outra unidade: só o farmacêutico dela ajusta.' END;
    END IF;
  END IF;
  IF p_id IS NULL OR d.status IN ('publicado', 'substituido') THEN
    IF p_id IS NULL THEN
      SELECT * INTO m FROM public.medicamento WHERE id = (p_dados ->> 'medicamento_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
      IF nullif(btrim(p_dados ->> 'via'), '') IS NULL THEN RAISE EXCEPTION 'Informe a via.'; END IF;
      v_unidade := nullif(btrim(coalesce(p_dados ->> 'unidade_id', '')), '')::uuid;
      IF NOT private.pode_editar_diluicao(v_unidade) THEN
        RAISE EXCEPTION '%', CASE WHEN v_unidade IS NULL
          THEN 'A diluição nova é da unidade: escolha a unidade. O modelo da rede só o super admin cria.'
          ELSE 'Só o farmacêutico da unidade cria a diluição dela.' END;
      END IF;
      INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, fonte, status, unidade_id)
      VALUES (m.id, m.principio_ativo, coalesce(m.apresentacao, ''), upper(btrim(p_dados ->> 'via')),
              coalesce(nullif(btrim(p_dados ->> 'fonte'), ''), 'a definir'), 'rascunho', v_unidade)
      RETURNING id INTO v_id;
    ELSE
      INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
        reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
        bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
        incompatibilidades, alta_vigilancia, risco_flebite, observacoes, fonte, data_revisao, revisor_crf, status, versao, unidade_id, origem_id)
      SELECT medicamento_id, principio_ativo, apresentacao, via, reconstituicao_diluente, reconstituicao_volume_ml,
        reconstituicao_concentracao, diluicao_solucao, diluicao_volume_min_ml, concentracao_maxima, tempo_infusao_min, velocidade_max,
        bolus_permitido, estabilidade_ta_h, estabilidade_refrig_h, fotossensivel, acesso, ajuste_renal, ajuste_renal_regra,
        incompatibilidades, alta_vigilancia, risco_flebite, observacoes, fonte, NULL, NULL, 'rascunho', versao + 1, unidade_id, id
      FROM public.diluicao WHERE id = p_id
      RETURNING id INTO v_id;
    END IF;
  ELSE
    v_id := p_id;
  END IF;
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
    alta_vigilancia = CASE WHEN p_dados ? 'alta_vigilancia' THEN coalesce((p_dados ->> 'alta_vigilancia')::boolean, false) ELSE alta_vigilancia END,
    risco_flebite = CASE WHEN p_dados ? 'risco_flebite' THEN (p_dados ->> 'risco_flebite')::boolean ELSE risco_flebite END,
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
  IF NOT (private.sou_farmaceutico() OR private.eh_super_admin()) THEN RAISE EXCEPTION 'Publicar diluição é do farmacêutico.'; END IF;
  SELECT * INTO d FROM public.diluicao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.status NOT IN ('rascunho', 'revisado') THEN RAISE EXCEPTION 'Só se publica rascunho.'; END IF;
  IF NOT private.pode_editar_diluicao(d.unidade_id) THEN
    RAISE EXCEPTION '%', CASE WHEN d.unidade_id IS NULL
      THEN 'Esta linha é do modelo da rede: só o super admin a publica.'
      ELSE 'Esta linha é do padrão de outra unidade: só o farmacêutico dela publica.' END;
  END IF;
  IF d.medicamento_id IS NULL THEN RAISE EXCEPTION 'Ligue a diluição a um medicamento do cadastro antes de publicar.'; END IF;
  IF nullif(btrim(d.revisor_crf), '') IS NULL THEN RAISE EXCEPTION 'Sem o CRF do revisor não publica.'; END IF;
  IF nullif(btrim(d.fonte), '') IS NULL OR d.fonte = 'a definir' THEN RAISE EXCEPTION 'Informe a fonte da diluição.'; END IF;
  IF upper(d.via) = 'EV' AND (d.diluicao_volume_min_ml IS NULL OR d.tempo_infusao_min IS NULL) THEN
    RAISE EXCEPTION 'Via EV: sem volume mínimo e tempo de infusão não publica.';
  END IF;
  IF d.origem_id IS NOT NULL AND length(btrim(coalesce(d.motivo_alteracao, ''))) < 10 THEN
    RAISE EXCEPTION 'Nova versão: diga o que mudou (mínimo de 10 letras).';
  END IF;
  UPDATE public.diluicao SET vigente_ate = now(), status = 'substituido'
   WHERE medicamento_id = d.medicamento_id AND upper(via) = upper(d.via) AND unidade_id IS NOT DISTINCT FROM d.unidade_id
     AND status = 'publicado' AND id <> d.id;
  UPDATE public.diluicao
     SET status = 'publicado', vigente_desde = now(), publicado_em = now(), publicado_por = v_perfil, data_revisao = current_date
   WHERE id = d.id;
  PERFORM private.registrar_auditoria('publicar_diluicao', 'diluicao', d.id, d.unidade_id,
    jsonb_build_object('medicamento', d.principio_ativo, 'via', d.via, 'versao', d.versao, 'unidade_id', d.unidade_id));
END $$;
