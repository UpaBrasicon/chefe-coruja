-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 7 — avisos de item devolvido pela farmácia e
-- de leito liberado (P2-01 e P2-02 do teste de ponta a ponta de 11/10/2026;
-- decisões do RT de 11/10/2026, BACKLOG.md).
--
-- • Item devolvido: avisa o médico que prescreveu; se ele não estiver de
--   plantão agora, avisa também os médicos escalados agora no setor do
--   paciente. O aviso traz paciente, item e motivo (categoria "Farmácia").
-- • Leito liberado (higienização concluída): avisa sempre o NIR da unidade;
--   os enfermeiros escalados agora no setor do leito só quando há paciente
--   sem leito naquele setor. A mensagem diz quantos aguardam (categoria
--   "Leitos").
-- ════════════════════════════════════════════════════════════════════════════

-- perfis com plantão em curso (dentro do horário da escala), por setor ou unidade
CREATE OR REPLACE FUNCTION private.escalados_agora(p_unidade uuid, p_setor uuid, p_papel text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ep.perfil_id
    FROM public.escala_plantao ep
    JOIN public.vinculos v ON v.perfil_id = ep.perfil_id AND v.unidade_id = p_unidade AND v.ativo AND v.papel::text = p_papel
   WHERE ep.unidade_id = p_unidade AND ep.ativo
     AND (p_setor IS NULL OR ep.setor_id = p_setor)
     AND now() >= ep.inicio AND now() < ep.inicio + make_interval(mins => ep.duracao_min)
$$;
REVOKE ALL ON FUNCTION private.escalados_agora(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.avisar_item_devolvido(p_item uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pr public.prescricoes; it public.prescricao_itens; v_setor uuid; v_nome text; v_msg text;
BEGIN
  SELECT p.* INTO pr FROM public.prescricoes p JOIN public.prescricao_itens i ON i.prescricao_id = p.id WHERE i.id = p_item;
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  SELECT coalesce(pa.nome_social, pa.nome), coalesce(
           -- onde o paciente está agora (a prescrição da porta segue na internação)
           (SELECT i.setor_atual_id FROM public.internacoes i
             WHERE i.paciente_id = pr.paciente_id AND i.data_alta IS NULL ORDER BY i.data_admissao DESC LIMIT 1),
           (SELECT i.setor_atual_id FROM public.internacoes i WHERE i.id = pr.internacao_id),
           (SELECT e.setor_id FROM public.episodios e WHERE e.id = pr.episodio_id),
           pa.setor_id)
    INTO v_nome, v_setor
    FROM public.pacientes pa WHERE pa.id = pr.paciente_id;
  v_msg := 'Farmácia devolveu para correção: ' || coalesce(it.descricao, 'item da prescrição') || ' — ' || v_nome
           || '. Motivo: ' || btrim(p_motivo);
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, pr.unidade_id, private.data_atual(), 'farm_devolvido_' || p_item, v_msg
    FROM (SELECT pr.medico_id AS q
          UNION
          SELECT x FROM private.escalados_agora(pr.unidade_id, v_setor, 'plantonista') x
           WHERE NOT EXISTS (SELECT 1 FROM private.escalados_agora(pr.unidade_id, NULL, 'plantonista') y WHERE y = pr.medico_id)) d
   WHERE q IS NOT NULL
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
END $$;
REVOKE ALL ON FUNCTION private.avisar_item_devolvido(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.avisar_leito_liberado(p_leito uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  l public.leitos; s public.setores; v_esperam int; v_msg text;
BEGIN
  SELECT * INTO l FROM public.leitos WHERE id = p_leito;
  SELECT * INTO s FROM public.setores WHERE id = l.setor_id;
  SELECT count(*) INTO v_esperam FROM public.internacoes i
   WHERE i.setor_atual_id = s.id AND i.data_alta IS NULL AND i.leito_atual_id IS NULL
     AND i.status IN ('admitido', 'em_observacao', 'internado');
  v_msg := 'Leito ' || l.identificador || ' (' || s.nome || ') liberado: higienização concluída. '
           || CASE v_esperam WHEN 0 THEN 'Ninguém aguarda leito neste setor.'
                             WHEN 1 THEN '1 paciente aguarda leito neste setor.'
                             ELSE v_esperam || ' pacientes aguardam leito neste setor.' END;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, s.unidade_id, private.data_atual(), 'leito_livre_' || p_leito, v_msg
    FROM (SELECT v.perfil_id AS q FROM public.vinculos v WHERE v.unidade_id = s.unidade_id AND v.ativo AND v.papel = 'nir'
          UNION
          SELECT x FROM private.escalados_agora(s.unidade_id, s.id, 'enfermeiro') x WHERE v_esperam > 0) d
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
END $$;
REVOKE ALL ON FUNCTION private.avisar_leito_liberado(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validar_item(p_item uuid, p_confere boolean, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE pr public.prescricoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT p.* INTO pr FROM public.prescricoes p JOIN public.prescricao_itens it ON it.prescricao_id = p.id WHERE it.id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF NOT private.farmaceutico_da(pr.unidade_id) THEN RAISE EXCEPTION 'A validação é do farmacêutico da unidade.'; END IF;
  IF NOT p_confere AND length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Devolver para correção exige motivo (mínimo de 10 letras).';
  END IF;
  INSERT INTO public.validacoes_prescricao (item_id, unidade_id, situacao, motivo, farmaceutico_id)
  VALUES (p_item, pr.unidade_id, CASE WHEN p_confere THEN 'confere' ELSE 'devolvido' END, nullif(btrim(p_motivo), ''), private.meu_perfil_id());
  -- devolvido: avisa quem prescreveu (e o setor, se ele não está de plantão)
  IF NOT p_confere THEN PERFORM private.avisar_item_devolvido(p_item, p_motivo); END IF;
  -- devolvido: avisa quem prescreveu (e o setor, se ele não está de plantão)
  IF NOT p_confere THEN PERFORM private.avisar_item_devolvido(p_item, p_motivo); END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.concluir_higienizacao(p_leito uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')
          OR private.tenho_papel(r.unidade_id, 'tecnico_enfermagem')) THEN
    RAISE EXCEPTION 'Só a enfermagem ou o gestor da unidade concluem a higienização.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'higienizacao' THEN
    RAISE EXCEPTION 'Leito % não está em higienização.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'higienizacao_concluida', 'higienizacao', 'livre', v_perfil, 'Higienização concluída');
  PERFORM private.avisar_leito_liberado(p_leito);
  PERFORM private.avisar_leito_liberado(p_leito);
END; $function$;
