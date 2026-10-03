-- Auditoria do frontend (03/10/2026), defeito 1: a checagem aceitava item
-- aprazado sem dizer o horário, e a pendência daquele horário continuava
-- "atrasada" (aprazamentos_atrasados casa pelo horario_previsto).
--  * checar: item aprazado (fora do "se necessário") exige um dos horários
--    do aprazamento;
--  * fila_checagem: devolve a situação de cada horário nas últimas 24 horas
--    (por_horario), para a tela mostrar o que falta por horário.
-- A assinatura de retorno da fila muda, então ela é recriada.

CREATE OR REPLACE FUNCTION public.checar(p_item uuid, p_situacao text, p_horario text DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item suspenso: não se checa.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.sou_enfermagem(pr.unidade_id) OR NOT private.paciente_no_meu_plantao(pr.paciente_id) THEN
    RAISE EXCEPTION 'A checagem é da enfermagem de plantão no setor do paciente.';
  END IF;
  IF p_situacao NOT IN ('feito', 'nao_feito', 'recusado') THEN RAISE EXCEPTION 'Situação desconhecida.'; END IF;
  IF p_situacao <> 'feito' AND length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Diga o motivo (não feito ou recusado).';
  END IF;
  IF p_horario IS NOT NULL AND p_horario !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido (use HH:MM).'; END IF;
  -- item aprazado (fora do "se necessário"): a checagem diz qual horário está
  -- sendo checado; sem isso a pendência continuaria "atrasada" para sempre
  IF NOT it.se_necessario AND cardinality(coalesce(it.horarios, '{}'::text[])) > 0 THEN
    IF p_horario IS NULL THEN
      RAISE EXCEPTION 'Escolha o horário aprazado que está sendo checado.';
    END IF;
    IF NOT (p_horario = ANY (it.horarios)) THEN
      RAISE EXCEPTION 'O horário % não está no aprazamento deste item (%).', p_horario, array_to_string(it.horarios, ', ');
    END IF;
  END IF;
  INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, motivo, registrado_por)
  VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, p_situacao, nullif(btrim(p_motivo), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

DROP FUNCTION IF EXISTS public.fila_checagem();
CREATE OR REPLACE FUNCTION public.fila_checagem()
RETURNS TABLE (paciente_id uuid, paciente_nome text, local text, item_id uuid, tipo text, descricao text, dose text, via text,
               posologia text, se_necessario boolean, horarios text[], diluicao_texto text, vasoativo boolean,
               ultima_situacao text, ultima_em timestamptz, ultima_por text, ultima_horario text, prescrito_em timestamptz,
               por_horario jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pa.id, coalesce(pa.nome_social, pa.nome),
         coalesce((SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
                    WHERE i.id = pr.internacao_id), (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id)),
         it.id, it.tipo, it.descricao, it.dose, it.via, it.posologia, it.se_necessario, it.horarios, it.diluicao_texto,
         coalesce(m.vasoativo, false), ad.situacao, ad.registrado_em, pf.nome_completo, ad.horario_previsto, it.created_at,
         -- última checagem de cada horário aprazado nas últimas 24 horas
         (SELECT coalesce(jsonb_object_agg(h.h, jsonb_build_object('situacao', ah.situacao, 'em', ah.registrado_em)), '{}'::jsonb)
            FROM unnest(coalesce(it.horarios, '{}'::text[])) h(h)
            JOIN LATERAL (SELECT a.situacao, a.registrado_em FROM public.administracoes a
                           WHERE a.item_id = it.id AND a.horario_previsto = h.h
                             AND a.registrado_em > now() - interval '24 hours'
                           ORDER BY a.registrado_em DESC LIMIT 1) ah ON true)
  FROM public.prescricoes pr
  JOIN public.pacientes pa ON pa.id = pr.paciente_id
  JOIN public.prescricao_itens it ON it.prescricao_id = pr.id AND it.suspenso_em IS NULL
  LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
  LEFT JOIN LATERAL (SELECT a.* FROM public.administracoes a WHERE a.item_id = it.id ORDER BY a.registrado_em DESC LIMIT 1) ad ON true
  LEFT JOIN public.perfis pf ON pf.id = ad.registrado_por
  WHERE pr.status = 'ativa' AND private.segundo_fator_ok()
    AND private.sou_enfermagem(pr.unidade_id) AND private.paciente_no_meu_plantao(pa.id)
  ORDER BY 2, it.ordem
$$;
REVOKE ALL ON FUNCTION public.fila_checagem() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fila_checagem() TO authenticated;
