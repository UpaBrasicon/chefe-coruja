-- Auditoria do frontend (03/10/2026), decisão do RT: 4º estado da alergia,
-- "desconhece" — a enfermagem perguntou e o paciente/acompanhante não soube
-- informar. É distinto de "não registrada" (ninguém perguntou) e de "nega"
-- (registro explícito de ausência). Não trava a prescrição (não há alergia
-- ativa), mas fica como declaração com autor e hora.
--
-- A tabela alergias_negacoes passa a guardar as duas declarações (nega |
-- desconhece); o índice de "uma vigente por paciente" continua valendo, então
-- os dois estados são mutuamente exclusivos (e qualquer um encerra o outro).

ALTER TABLE public.alergias_negacoes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'nega';
ALTER TABLE public.alergias_negacoes DROP CONSTRAINT IF EXISTS alergias_negacoes_tipo_check;
ALTER TABLE public.alergias_negacoes
  ADD CONSTRAINT alergias_negacoes_tipo_check CHECK (tipo IN ('nega', 'desconhece'));
COMMENT ON COLUMN public.alergias_negacoes.tipo IS
  'nega = registro explícito de ausência de alergia; desconhece = perguntou e não soube informar.';

-- ── estado em quatro valores ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.estado_alergia(p_paciente uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL) THEN 'tem'
    ELSE coalesce((SELECT CASE WHEN n.tipo = 'desconhece' THEN 'desconhece' ELSE 'nega' END
                     FROM public.alergias_negacoes n
                    WHERE n.paciente_id = p_paciente AND n.encerrada_em IS NULL LIMIT 1), 'nao_registrada')
  END
$$;
REVOKE ALL ON FUNCTION public.estado_alergia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_alergia(uuid) TO authenticated;

-- ── registrar "desconhece" e "nega" por um corpo só ─────────────────────────
CREATE OR REPLACE FUNCTION private.registrar_declaracao_alergia(p_paciente uuid, p_tipo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_unidade uuid; v_lista text;
BEGIN
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_tipo NOT IN ('nega', 'desconhece') THEN RAISE EXCEPTION 'Declaração de alergia inválida.'; END IF;
  PERFORM private.travar_alergias_do_paciente(p_paciente);
  SELECT string_agg(substancia, ', ' ORDER BY registrado_em) INTO v_lista
    FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL;
  IF v_lista IS NOT NULL THEN
    RAISE EXCEPTION 'O paciente tem alergia ativa registrada (%). Inative antes cada uma, com o motivo.', v_lista;
  END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  -- o que estava vigente (nega ou desconhece) vai para o histórico
  UPDATE public.alergias_negacoes
     SET encerrada_em = now(), encerrada_por = private.meu_perfil_id(),
         motivo_encerramento = CASE WHEN tipo = p_tipo THEN 'Reconfirmado' ELSE 'Trocado para ' || p_tipo END
   WHERE paciente_id = p_paciente AND encerrada_em IS NULL;
  INSERT INTO public.alergias_negacoes (unidade_id, paciente_id, registrado_por, tipo)
  VALUES (v_unidade, p_paciente, private.meu_perfil_id(), p_tipo)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.registrar_declaracao_alergia(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_nega_alergia(p_paciente uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  RETURN private.registrar_declaracao_alergia(p_paciente, 'nega');
END $$;
REVOKE ALL ON FUNCTION public.registrar_nega_alergia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_nega_alergia(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_desconhece_alergia(p_paciente uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  RETURN private.registrar_declaracao_alergia(p_paciente, 'desconhece');
END $$;
REVOKE ALL ON FUNCTION public.registrar_desconhece_alergia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_desconhece_alergia(uuid) TO authenticated;

-- ── painel: estado em quatro valores e tipo da declaração ───────────────────
CREATE OR REPLACE FUNCTION public.alergias_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(v_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)
          OR private.acesso_encerrado_vigente(p_paciente) OR private.teleinterconsulta_vigente(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN jsonb_build_object(
    'estado', public.estado_alergia(p_paciente),
    'alergias', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'substancia', a.substancia, 'tipo', a.tipo, 'gravidade', a.gravidade, 'reacao', a.reacao,
        'medicamento_id', a.medicamento_id, 'registrado_em', a.registrado_em, 'autor', pr.nome_completo,
        'inativada_em', a.inativada_em, 'inativada_por', pi.nome_completo, 'motivo_inativacao', a.motivo_inativacao)
        ORDER BY a.inativada_em IS NOT NULL, a.registrado_em DESC)
      FROM public.alergias_paciente a
      LEFT JOIN public.perfis pr ON pr.id = a.registrado_por
      LEFT JOIN public.perfis pi ON pi.id = a.inativada_por
      WHERE a.paciente_id = p_paciente), '[]'::jsonb),
    'negacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id, 'tipo', n.tipo, 'registrado_em', n.registrado_em, 'autor', pr.nome_completo,
        'encerrada_em', n.encerrada_em, 'encerrada_por', pe.nome_completo, 'motivo_encerramento', n.motivo_encerramento)
        ORDER BY n.encerrada_em IS NOT NULL, n.registrado_em DESC)
      FROM public.alergias_negacoes n
      LEFT JOIN public.perfis pr ON pr.id = n.registrado_por
      LEFT JOIN public.perfis pe ON pe.id = n.encerrada_por
      WHERE n.paciente_id = p_paciente), '[]'::jsonb),
    'eventos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'evento', e.evento, 'grau', e.grau, 'observacao', e.observacao,
        'prescricao_item_id', e.prescricao_item_id, 'item_descricao', e.item_descricao,
        'registrado_em', e.registrado_em, 'autor', pr.nome_completo, 'grau_em', e.grau_em,
        'inativado_em', e.inativado_em, 'inativado_por', pi.nome_completo, 'motivo_inativacao', e.motivo_inativacao,
        'graus', (SELECT jsonb_agg(jsonb_build_object('grau', g.grau, 'registrado_em', g.registrado_em, 'autor', pg.nome_completo)
                                   ORDER BY g.registrado_em)
                    FROM public.eventos_adversos_graus g LEFT JOIN public.perfis pg ON pg.id = g.registrado_por
                   WHERE g.evento_id = e.id))
        ORDER BY e.inativado_em IS NOT NULL, e.grau_em DESC)
      FROM public.eventos_adversos e
      LEFT JOIN public.perfis pr ON pr.id = e.registrado_por
      LEFT JOIN public.perfis pi ON pi.id = e.inativado_por
      WHERE e.paciente_id = p_paciente), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.alergias_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alergias_do_paciente(uuid) TO authenticated;
