-- Fase 2, tarefa 1 revista (decisão do RT de 09/10/2026): o controle da alta
-- vigilância passa da dupla conferência de enfermagem para a LIBERAÇÃO DA
-- FARMÁCIA.
--   • vale a mesma lista (ISMP Brasil + ajustes da unidade);
--   • o farmacêutico libera o ITEM da prescrição pela validação que já existe
--     (validar_item com "confere"); item alterado é item novo e precisa de nova
--     liberação;
--   • sem liberação (sem farmacêutico de plantão), a enfermagem administra com
--     justificativa; a administração fica marcada e entra na lista do
--     farmacêutico para conferir depois.
--
-- Só aditiva (expand): coluna nova com default, funções novas e checar()
-- recriada com a mesma assinatura. A dupla conferência antiga continua aceita
-- em checar() enquanto o frontend antigo existir (transição); as tabelas e
-- funções da dupla ficam, sem uso pela tela nova.

ALTER TABLE public.administracoes ADD COLUMN IF NOT EXISTS sem_liberacao boolean NOT NULL DEFAULT false;

-- item liberado = última validação da farmácia é "confere"
CREATE OR REPLACE FUNCTION private.liberado_pela_farmacia(p_item uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT vp.situacao = 'confere' FROM public.validacoes_prescricao vp
                    WHERE vp.item_id = p_item ORDER BY vp.em DESC LIMIT 1), false);
$$;
REVOKE ALL ON FUNCTION private.liberado_pela_farmacia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.liberado_pela_farmacia(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.checar(p_item uuid, p_situacao text, p_horario text DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid; v_dupla uuid; v_sem_liberacao boolean := false;
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
  IF NOT it.se_necessario AND cardinality(coalesce(it.horarios, '{}'::text[])) > 0 THEN
    IF p_horario IS NULL THEN
      RAISE EXCEPTION 'Escolha o horário aprazado que está sendo checado.';
    END IF;
    IF NOT (p_horario = ANY (it.horarios)) THEN
      RAISE EXCEPTION 'O horário % não está no aprazamento deste item (%).', p_horario, array_to_string(it.horarios, ', ');
    END IF;
  END IF;
  -- alta vigilância: liberado pela farmácia, ou (transição) dupla conferência
  -- completa, ou administração com justificativa, marcada para conferir depois
  IF p_situacao = 'feito' AND it.medicamento_id IS NOT NULL AND private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id)
     AND NOT private.liberado_pela_farmacia(it.id) THEN
    SELECT id INTO v_dupla FROM public.duplas_checagens
     WHERE item_id = it.id AND horario_previsto IS NOT DISTINCT FROM p_horario AND usada_em IS NULL
       AND segundo_por IS NOT NULL AND primeiro_em > now() - interval '2 hours'
     ORDER BY primeiro_em DESC LIMIT 1 FOR UPDATE;
    IF v_dupla IS NOT NULL THEN
      UPDATE public.duplas_checagens SET usada_em = now() WHERE id = v_dupla;
    ELSIF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
      RAISE EXCEPTION 'Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois.';
    ELSE
      v_sem_liberacao := true;
    END IF;
  END IF;
  INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, motivo, registrado_por, sem_liberacao)
  VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, p_situacao, nullif(btrim(p_motivo), ''), private.meu_perfil_id(), v_sem_liberacao)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Checagem: para os itens na tela, se exigem liberação e quem liberou
CREATE OR REPLACE FUNCTION public.liberacao_farmacia(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'item_id', it.id,
           'regra', coalesce(m.alta_vigilancia_regra, 'Marcado pela farmácia'),
           'situacao', v.situacao, 'motivo', v.motivo, 'por', pf.nome_completo, 'em', v.em)), '[]'::jsonb)
    FROM public.prescricao_itens it
    JOIN public.prescricoes pr ON pr.id = it.prescricao_id
    LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
    LEFT JOIN LATERAL (SELECT vp.situacao, vp.motivo, vp.em, vp.farmaceutico_id FROM public.validacoes_prescricao vp
                        WHERE vp.item_id = it.id ORDER BY vp.em DESC LIMIT 1) v ON true
    LEFT JOIN public.perfis pf ON pf.id = v.farmaceutico_id
   WHERE it.id = ANY (p_itens) AND it.medicamento_id IS NOT NULL
     AND private.segundo_fator_ok() AND private.membro_da_unidade(pr.unidade_id)
     AND private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id);
$$;
REVOKE ALL ON FUNCTION public.liberacao_farmacia(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberacao_farmacia(uuid[]) TO authenticated;

-- Farmácia: administrações sem liberação que o farmacêutico ainda não
-- conferiu (sem validação do item depois da administração)
CREATE OR REPLACE FUNCTION public.administracoes_sem_liberacao(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.farmaceutico_da(p_unidade) OR private.tenho_papel(p_unidade, 'gestor') IS TRUE) THEN
    RAISE EXCEPTION 'Lista da farmácia (farmacêutico ou gestor).' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id, 'item_id', it.id, 'paciente', coalesce(pa.nome_social, pa.nome),
             'local', (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id),
             'descricao', it.descricao, 'dose', it.dose, 'via', it.via, 'posologia', it.posologia,
             'horario', a.horario_previsto, 'justificativa', a.motivo,
             'administrado_por', p.nome_completo, 'administrado_em', a.registrado_em)
             ORDER BY a.registrado_em)
      FROM public.administracoes a
      JOIN public.prescricao_itens it ON it.id = a.item_id
      JOIN public.pacientes pa ON pa.id = a.paciente_id
      LEFT JOIN public.perfis p ON p.id = a.registrado_por
     WHERE a.unidade_id = p_unidade AND a.sem_liberacao
       AND NOT EXISTS (SELECT 1 FROM public.validacoes_prescricao vp WHERE vp.item_id = a.item_id AND vp.em >= a.registrado_em)
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.administracoes_sem_liberacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.administracoes_sem_liberacao(uuid) TO authenticated;

-- fila de validação: "alta vigilância" passa a seguir a lista da unidade
-- (ISMP + ajustes), a mesma que exige a liberação; mesma assinatura
CREATE OR REPLACE FUNCTION public.fila_validacao(p_unidade uuid)
RETURNS TABLE (item_id uuid, paciente_nome text, local text, descricao text, dose text, via text, posologia text,
               se_necessario boolean, peso_kg numeric, diluicao_versao int, diluicao_texto text, diluicao_divergente boolean,
               justificativa_divergencia text, incompatibilidades text[], alta_vigilancia boolean, prescrito_por text, prescrito_em timestamptz,
               ultima_situacao text, ultimo_motivo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.farmaceutico_da(p_unidade) THEN RAISE EXCEPTION 'A validação é do farmacêutico da unidade.'; END IF;
  RETURN QUERY
  SELECT it.id, coalesce(pa.nome_social, pa.nome),
         coalesce((SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = pr.internacao_id),
                  (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id)),
         it.descricao, it.dose, it.via, it.posologia, it.se_necessario, it.peso_kg, it.diluicao_versao, it.diluicao_texto,
         it.diluicao_divergente, it.justificativa_divergencia, d.incompatibilidades,
         CASE WHEN it.medicamento_id IS NULL THEN false ELSE private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) END,
         pf.nome_completo, it.created_at, v.situacao, v.motivo
  FROM public.prescricoes pr
  JOIN public.pacientes pa ON pa.id = pr.paciente_id
  JOIN public.prescricao_itens it ON it.prescricao_id = pr.id AND it.suspenso_em IS NULL AND it.tipo = 'medicamento'
  LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
  LEFT JOIN public.diluicao d ON d.id = it.diluicao_id
  LEFT JOIN public.perfis pf ON pf.id = it.autor_id
  LEFT JOIN LATERAL (SELECT vp.situacao, vp.motivo FROM public.validacoes_prescricao vp WHERE vp.item_id = it.id ORDER BY vp.em DESC LIMIT 1) v ON true
  WHERE pr.unidade_id = p_unidade AND pr.status = 'ativa' AND coalesce(v.situacao, '') <> 'confere'
  ORDER BY (v.situacao IS NULL) DESC,
           (CASE WHEN it.medicamento_id IS NULL THEN false ELSE private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) END) DESC,
           it.created_at;
END $$;
