-- Fase 2, tarefa 6 do BACKLOG.md — alteração versionada de item de prescrição.
--
-- Decisão do RT (08/10/2026): só o médico altera, com motivo; a versão
-- anterior fica guardada; a enfermagem vê o aviso na checagem.
--   • alterar = suspender o item atual ("Alterado: <motivo>") e criar a nova
--     versão pelo mesmo caminho da prescrição (public.prescrever: alergia,
--     peso da criança, diluição vigente, item repetido) — tudo na mesma
--     transação; se a nova versão não passa, nada muda;
--   • a nova versão aponta a anterior (substitui_item_id) e leva o número da
--     versão; as checagens da anterior continuam nela;
--   • horários: se a frequência não mudou, a nova versão herda o aprazamento;
--     se mudou, volta a pedir aprazamento;
--   • medicamento só; cuidado se suspende e se prescreve de novo.
-- Só aditiva: colunas novas em prescricao_itens e funções novas.
--
-- ROLLBACK: DROP FUNCTION public.alterar_item_prescricao, public.alteracoes_de_itens;
--   ALTER TABLE public.prescricao_itens DROP COLUMN substitui_item_id, DROP COLUMN versao, DROP COLUMN motivo_alteracao.

ALTER TABLE public.prescricao_itens
  ADD COLUMN IF NOT EXISTS substitui_item_id uuid REFERENCES public.prescricao_itens(id),
  ADD COLUMN IF NOT EXISTS versao int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS motivo_alteracao text;
CREATE INDEX IF NOT EXISTS prescricao_itens_substitui ON public.prescricao_itens (substitui_item_id) WHERE substitui_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.alterar_item_prescricao(p_item uuid, p_mudancas jsonb, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  it public.prescricao_itens;
  pr public.prescricoes;
  v_novo uuid;
  v_item jsonb;
  v_dose text; v_via text; v_pos text; v_sn boolean; v_obs text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item FOR UPDATE;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou já suspenso.'; END IF;
  IF it.tipo <> 'medicamento' THEN RAISE EXCEPTION 'Só medicamento se altera; cuidado se suspende e se prescreve de novo.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.paciente_no_meu_plantao(pr.paciente_id) OR private.tenho_papel(pr.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Alterar a prescrição é do médico de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Diga por que altera (mínimo de 5 letras).'; END IF;

  v_dose := coalesce(nullif(btrim(p_mudancas ->> 'dose'), ''), it.dose);
  v_via := upper(coalesce(nullif(btrim(p_mudancas ->> 'via'), ''), it.via));
  v_pos := coalesce(nullif(btrim(p_mudancas ->> 'posologia'), ''), it.posologia);
  v_sn := coalesce((p_mudancas ->> 'se_necessario')::boolean, it.se_necessario);
  v_obs := CASE WHEN p_mudancas ? 'observacao' THEN nullif(btrim(p_mudancas ->> 'observacao'), '') ELSE it.observacao END;
  IF v_dose IS NOT DISTINCT FROM it.dose AND v_via IS NOT DISTINCT FROM upper(it.via) AND v_pos IS NOT DISTINCT FROM it.posologia
     AND v_sn = it.se_necessario AND v_obs IS NOT DISTINCT FROM it.observacao THEN
    RAISE EXCEPTION 'Nada mudou: altere dose, via, frequência, "se necessário" ou observação.';
  END IF;

  -- a anterior sai da prescrição vigente (fica guardada, com o motivo)
  UPDATE public.prescricao_itens
     SET suspenso_em = now(), suspenso_por = private.meu_perfil_id(), motivo_suspensao = 'Alterado: ' || btrim(p_motivo)
   WHERE id = it.id;

  -- a nova versão passa pelas mesmas travas da prescrição
  v_item := jsonb_build_object('tipo', 'medicamento', 'medicamento_id', it.medicamento_id, 'dose', v_dose, 'via', v_via,
                               'posologia', v_pos, 'se_necessario', v_sn, 'observacao', v_obs);
  IF it.diluicao_divergente AND v_via = upper(it.via) THEN
    v_item := v_item || jsonb_build_object('diluicao_divergente', it.diluicao_texto, 'justificativa_divergencia', it.justificativa_divergencia);
  END IF;
  v_novo := public.prescrever(pr.paciente_id, v_item);

  UPDATE public.prescricao_itens
     SET substitui_item_id = it.id, versao = it.versao + 1, motivo_alteracao = btrim(p_motivo), ordem = it.ordem,
         horarios = CASE WHEN v_pos IS NOT DISTINCT FROM it.posologia AND NOT v_sn THEN it.horarios END
   WHERE id = v_novo;
  PERFORM private.registrar_auditoria('alterar_item_prescricao', 'prescricao_itens', v_novo, pr.unidade_id,
    jsonb_build_object('anterior', it.id, 'versao', it.versao + 1,
                       'antes', jsonb_build_object('dose', it.dose, 'via', it.via, 'posologia', it.posologia, 'se_necessario', it.se_necessario),
                       'depois', jsonb_build_object('dose', v_dose, 'via', v_via, 'posologia', v_pos, 'se_necessario', v_sn)));
  RETURN v_novo;
END $$;
REVOKE ALL ON FUNCTION public.alterar_item_prescricao(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_item_prescricao(uuid, jsonb, text) TO authenticated;

-- para a checagem e a prescrição: a versão anterior de cada item alterado
CREATE OR REPLACE FUNCTION public.alteracoes_de_itens(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'item_id', it.id, 'versao', it.versao, 'motivo', it.motivo_alteracao,
           'alterado_em', it.created_at, 'alterado_por', p.nome_completo,
           'anterior', jsonb_build_object('dose', a.dose, 'via', a.via, 'posologia', a.posologia, 'se_necessario', a.se_necessario,
                                          'observacao', a.observacao, 'horarios', a.horarios))), '[]'::jsonb)
    FROM public.prescricao_itens it
    JOIN public.prescricao_itens a ON a.id = it.substitui_item_id
    JOIN public.prescricoes pr ON pr.id = it.prescricao_id
    LEFT JOIN public.perfis p ON p.id = it.autor_id
   WHERE it.id = ANY (p_itens) AND private.segundo_fator_ok() AND private.membro_da_unidade(pr.unidade_id);
$$;
REVOKE ALL ON FUNCTION public.alteracoes_de_itens(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alteracoes_de_itens(uuid[]) TO authenticated;
