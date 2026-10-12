-- ════════════════════════════════════════════════════════════════════════════
-- Correções do portão, tarefa 1 — fechar o que fica aberto no desfecho
-- (P1-03 e P1-02 do teste de ponta a ponta de 11/10/2026; decisões do RT de
-- 11/10/2026, BACKLOG.md).
--
-- • Todo desfecho que tira o paciente da unidade encerra as prescrições ativas
--   (alta da porta, alta da observação ou da internação, evasão, alta a pedido,
--   óbito e transferência externa). Quando a porta vira observação ou
--   internação, a prescrição da porta continua valendo.
-- • Óbito e transferência externa não esperam o que ficou aberto: exames sem
--   resultado são cancelados com o motivo, pareceres são cancelados, passagens
--   de plantão são retiradas e pendências são canceladas, tudo auditado. Só o
--   agravo suspeito sem notificação continua impedindo. Rascunho de documento
--   fica como rascunho, sem impedir.
-- • Acesso da equipe depois da alta: a escrita do cuidado fecha na hora
--   (checar, aprazar, sinais, prescrição, exames, registros de enfermagem:
--   private.paciente_em_cuidado_no_plantao, só com o atendimento ou a
--   internação aberta). O resto (leitura, documentos da alta e do óbito, AIH,
--   notificação) vale para a equipe do setor por 24 horas depois da alta
--   (private.paciente_no_meu_plantao, que antes valia sem prazo). Depois disso,
--   só pelo pedido de acesso ao gestor.
-- • Cancelar a alta reabre as prescrições encerradas por ela. Exames,
--   pareceres, passagens e pendências cancelados no óbito ou na transferência
--   continuam cancelados (o motivo fica registrado).
-- ════════════════════════════════════════════════════════════════════════════

-- ── prescrição encerrada ─────────────────────────────────────────────────────
ALTER TABLE public.prescricoes
  ADD COLUMN IF NOT EXISTS encerrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrada_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS motivo_encerramento text;

CREATE OR REPLACE FUNCTION private.encerrar_prescricoes(p_internacao uuid, p_episodio uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pr record;
BEGIN
  FOR pr IN
    UPDATE public.prescricoes
       SET status = 'encerrada', encerrada_em = now(), encerrada_por = private.meu_perfil_id(),
           motivo_encerramento = p_motivo, updated_at = now()
     WHERE status = 'ativa'
       AND ((p_internacao IS NOT NULL AND internacao_id = p_internacao) OR (p_episodio IS NOT NULL AND episodio_id = p_episodio))
    RETURNING id, unidade_id
  LOOP
    PERFORM private.registrar_auditoria('encerrar_prescricao', 'prescricoes', pr.id, pr.unidade_id,
      jsonb_build_object('status', 'encerrada', 'motivo', p_motivo, 'automatico', true));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.encerrar_prescricoes(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- ── exames sem resultado cancelados com motivo ───────────────────────────────
CREATE OR REPLACE FUNCTION private.cancelar_exames_pedidos(p_internacao uuid, p_episodio uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ex record;
BEGIN
  FOR ex IN
    UPDATE public.exames_pedidos
       SET situacao = 'cancelado', motivo_cancelamento = p_motivo, resolvido_por = private.meu_perfil_id(), resolvido_em = now()
     WHERE situacao = 'pedido'
       AND ((p_internacao IS NOT NULL AND internacao_id = p_internacao) OR (p_episodio IS NOT NULL AND episodio_id = p_episodio))
    RETURNING id, unidade_id, exame
  LOOP
    PERFORM private.registrar_auditoria('cancelar_exame', 'exames_pedidos', ex.id, ex.unidade_id,
      jsonb_build_object('situacao', 'cancelado', 'exame', ex.exame, 'motivo', p_motivo, 'automatico', true));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.cancelar_exames_pedidos(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- ── óbito e transferência externa: o que ficou aberto na internação ─────────
CREATE OR REPLACE FUNCTION private.encerrar_abertos_da_internacao(i public.internacoes, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  pm public.pareceres_medicos;
  d public.documentos_clinicos;
  x record;
BEGIN
  PERFORM private.cancelar_exames_pedidos(i.id, i.episodio_id, p_motivo || ': exame cancelado sem resultado.');

  -- pareceres pendentes: mesmo registro do cancelamento manual, com documento
  FOR pm IN SELECT * FROM public.pareceres_medicos
             WHERE (internacao_id = i.id OR (i.episodio_id IS NOT NULL AND episodio_id = i.episodio_id))
               AND status IN ('solicitado', 'em_analise') FOR UPDATE
  LOOP
    d := private.gravar_documento_episodio(NULL, pm.paciente_id, 'parecer',
      'CANCELAMENTO DE SOLICITAÇÃO DE PARECER MÉDICO' || E'\n' ||
      'Especialidade: ' || pm.especialidade ||
        coalesce(' — solicitação nº ' || (SELECT numero FROM public.documentos_clinicos WHERE id = pm.documento_solicitacao_id), '') || E'\n' ||
      'Cancelado por: ' || private.identificacao_medico(v_perfil) || E'\n' ||
      'Data e hora: ' || private.hora_brasilia(now()) || ' (Brasília)' || E'\n' ||
      CASE WHEN pm.status = 'em_analise' THEN 'Estava em análise por: ' || private.identificacao_medico(pm.analista_id) || E'\n' ELSE '' END ||
      E'\n' || 'Motivo:' || E'\n' || p_motivo || ': parecer cancelado sem resposta.',
      pm.episodio_id, NULL, NULL, v_perfil, now(), false, NULL);
    UPDATE public.pareceres_medicos
       SET status = 'cancelado', cancelado_em = now(), cancelado_por = v_perfil,
           motivo_cancelamento = p_motivo || ': parecer cancelado sem resposta.',
           documento_cancelamento_id = d.id, rascunho = NULL, rascunho_salvo_em = NULL
     WHERE id = pm.id;
    PERFORM private.registrar_auditoria('cancelar_parecer', 'pareceres_medicos', pm.id, pm.unidade_id,
      jsonb_build_object('status', 'cancelado', 'status_anterior', pm.status, 'automatico', true));
  END LOOP;

  FOR x IN
    UPDATE public.passagens_plantao
       SET situacao = 'retirada', respondida_em = now(), motivo_recusa = p_motivo || ': passagem retirada.'
     WHERE internacao_id = i.id AND situacao = 'aguardando'
    RETURNING id, unidade_id
  LOOP
    PERFORM private.registrar_auditoria('retirar_passagem', 'passagens_plantao', x.id, x.unidade_id,
      jsonb_build_object('situacao', 'retirada', 'motivo', p_motivo, 'automatico', true));
  END LOOP;

  -- só as que impedem a alta: as outras o gatilho da internação já cancela, e a
  -- pendência da observação é concluída por ele (private.internacao_conduz_episodio)
  FOR x IN
    UPDATE public.pendencias
       SET situacao = 'cancelada', resolvida_em = now(), resolvida_por = v_perfil,
           motivo_resolucao = p_motivo || ': pendência cancelada.'
     WHERE internacao_id = i.id AND situacao = 'aberta' AND impeditiva AND tipo <> 'observacao'
    RETURNING id, unidade_id
  LOOP
    PERFORM private.registrar_auditoria('cancelar_pendencia', 'pendencias', x.id, x.unidade_id,
      jsonb_build_object('situacao', 'cancelada', 'motivo', p_motivo, 'automatico', true));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.encerrar_abertos_da_internacao(public.internacoes, text) FROM PUBLIC, anon, authenticated;

-- ── acesso: cuidado só com a internação aberta; o resto por 24 h ─────────────
-- Cuidado agora: o paciente está no setor da minha escala (porta) ou numa
-- internação aberta num setor da minha escala.
CREATE OR REPLACE FUNCTION private.paciente_em_cuidado_no_plantao(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND pa.setor_id IN (SELECT private.setores_na_escala_agora())
  ) OR EXISTS (
    SELECT 1 FROM public.internacoes i
    WHERE i.paciente_id = p_paciente
      AND i.data_alta IS NULL
      AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
  );
$$;
REVOKE ALL ON FUNCTION private.paciente_em_cuidado_no_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.paciente_em_cuidado_no_plantao(uuid) TO authenticated;

-- No plantão: o cuidado agora e, por 24 horas depois da alta (contadas do
-- registro da alta) ou do desfecho da porta, a equipe do setor onde ele estava.
-- Antes valia para qualquer internação passada, sem prazo.
CREATE OR REPLACE FUNCTION private.paciente_no_meu_plantao(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.paciente_em_cuidado_no_plantao(p_paciente)
      OR EXISTS (
        SELECT 1 FROM public.internacoes i
         WHERE i.paciente_id = p_paciente
           AND i.data_alta IS NOT NULL
           AND coalesce(i.alta_registrada_em, i.data_alta) > now() - interval '24 hours'
           AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora()))
      OR EXISTS (
        SELECT 1 FROM public.episodios e
         WHERE e.paciente_id = p_paciente
           AND e.etapa = 'encerrado'
           AND e.encerrado_em > now() - interval '24 hours'
           AND e.setor_id IN (SELECT private.setores_na_escala_agora()));
$$;

-- Registro que chega pela fila offline: vale o plantão na hora do fato, e a
-- internação precisa estar aberta naquela hora (o que foi feito antes da alta
-- ainda entra; o que tem hora depois da alta, não).
CREATE OR REPLACE FUNCTION private.podia_atuar_no_paciente_em(p_paciente uuid, p_momento timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND (   private.eh_super_admin()
           OR private.papel_na_unidade(pa.unidade_id) = 'gestor'
           OR pa.setor_id IN (SELECT private.setores_em_plantao_em(p_momento))
           OR EXISTS (SELECT 1 FROM public.internacoes i
                      WHERE i.paciente_id = pa.id
                        AND i.data_admissao <= p_momento
                        AND (i.data_alta IS NULL OR i.data_alta > p_momento)
                        AND i.setor_atual_id IN (SELECT private.setores_em_plantao_em(p_momento))))
  );
$$;

-- escritas do cuidado passam a exigir o atendimento ou a internação aberta
CREATE OR REPLACE FUNCTION private.exigir_enfermagem(p_paciente uuid, p_so_enfermeiro boolean)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_unidade uuid;
BEGIN
  SELECT pa.unidade_id INTO v_unidade FROM public.pacientes pa WHERE pa.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF p_so_enfermeiro AND private.tenho_papel(v_unidade, 'enfermeiro') IS NOT TRUE THEN
    RAISE EXCEPTION 'A SAE é do enfermeiro.';
  END IF;
  IF NOT p_so_enfermeiro AND private.sou_enfermagem(v_unidade) IS NOT TRUE THEN
    RAISE EXCEPTION 'Este registro é da enfermagem.';
  END IF;
  IF private.paciente_em_cuidado_no_plantao(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.';
  END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.alertas_sepse(p_unidade uuid)
 RETURNS TABLE(paciente_id uuid, nivel text, total integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; ph jsonb; g jsonb; v_meses int;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  FOR r IN
    SELECT DISTINCT p.id, p.data_nascimento FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento > current_date - interval '14 years'
      AND (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_em_cuidado_no_plantao(p.id))
  LOOP
    g := private.gatilho_infeccao(r.id);
    CONTINUE WHEN g IS NULL;
    v_meses := (extract(year FROM age(current_date, r.data_nascimento)) * 12 + extract(month FROM age(current_date, r.data_nascimento)))::int;
    ph := private.calcular_phoenix(r.id, v_meses, g);
    paciente_id := r.id;
    total := (ph ->> 'total')::int;
    nivel := CASE WHEN (ph ->> 'choque')::boolean THEN 'choque' WHEN (ph ->> 'sepse')::boolean THEN 'sepse' ELSE 'rastreio' END;
    RETURN NEXT;
  END LOOP;
END $function$
;

CREATE OR REPLACE FUNCTION public.alterar_item_prescricao(p_item uuid, p_mudancas jsonb, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  IF NOT private.paciente_em_cuidado_no_plantao(pr.paciente_id) OR private.tenho_papel(pr.unidade_id, 'plantonista') IS NOT TRUE THEN
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
  -- interação crítica já justificada na versão anterior: a justificativa segue (Fase 2, tarefa 3)
  v_item := v_item || coalesce((SELECT jsonb_build_object('justificativa_interacao', 'Mantida da versão anterior: ' || a.justificativa)
                                  FROM public.alertas_interacao a WHERE a.item_id = it.id ORDER BY a.em DESC LIMIT 1), '{}'::jsonb);
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
END $function$
;

CREATE OR REPLACE FUNCTION public.aprazar(p_item uuid, p_horarios text[], p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE it public.prescricao_itens; pr public.prescricoes; h text; v_lista text[]; v_sug text[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou suspenso.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF private.tenho_papel(pr.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT private.paciente_em_cuidado_no_plantao(pr.paciente_id) THEN
    RAISE EXCEPTION 'O aprazamento é do enfermeiro de plantão no setor do paciente.';
  END IF;
  FOREACH h IN ARRAY coalesce(p_horarios, '{}') LOOP
    IF h !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido: % (use HH:MM).', h; END IF;
  END LOOP;
  v_lista := coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_horarios) x), '{}');
  SELECT array_agg(x ORDER BY x) INTO v_sug FROM jsonb_array_elements_text(private.sugestao_aprazamento(it.id) -> 'horarios') x;
  UPDATE public.prescricao_itens SET horarios = v_lista WHERE id = it.id;
  INSERT INTO public.aprazamentos (item_id, unidade_id, horarios, sugeridos, ajustado, motivo, por)
  VALUES (it.id, pr.unidade_id, v_lista, v_sug, v_sug IS DISTINCT FROM v_lista,
          nullif(btrim(coalesce(p_motivo, '')), ''), private.meu_perfil_id());
END $function$
;

CREATE OR REPLACE FUNCTION public.checar(p_item uuid, p_situacao text, p_horario text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid; v_dupla uuid; v_sem_liberacao boolean := false;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item suspenso: não se checa.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.sou_enfermagem(pr.unidade_id) OR NOT private.paciente_em_cuidado_no_plantao(pr.paciente_id) THEN
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
END $function$
;

CREATE OR REPLACE FUNCTION public.conferir_alta_vigilancia(p_item uuid, p_horario text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  it public.prescricao_itens;
  pr public.prescricoes;
  d  public.duplas_checagens;
  v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou suspenso.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF it.medicamento_id IS NULL OR NOT private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) THEN
    RAISE EXCEPTION 'Este item não exige dupla checagem.';
  END IF;
  -- conferência em aberto para este horário (não usada, das últimas 2 horas)
  SELECT * INTO d FROM public.duplas_checagens
   WHERE item_id = it.id AND horario_previsto IS NOT DISTINCT FROM p_horario AND usada_em IS NULL
     AND primeiro_em > now() - interval '2 hours'
   ORDER BY primeiro_em DESC LIMIT 1 FOR UPDATE;

  IF d.id IS NULL THEN
    IF NOT private.sou_enfermagem(pr.unidade_id) OR NOT private.paciente_em_cuidado_no_plantao(pr.paciente_id) THEN
      RAISE EXCEPTION 'A primeira conferência é da enfermagem de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    INSERT INTO public.duplas_checagens (item_id, paciente_id, unidade_id, horario_previsto, primeiro_por)
    VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, v_eu);
    PERFORM private.registrar_auditoria('primeira_conferencia', 'prescricao_itens', it.id, pr.unidade_id,
      jsonb_build_object('horario', p_horario));
    RETURN 'primeira';
  END IF;
  IF d.segundo_por IS NOT NULL THEN RAISE EXCEPTION 'As duas conferências já foram feitas: registre a administração.'; END IF;
  IF d.primeiro_por = v_eu THEN
    RAISE EXCEPTION 'A segunda conferência é de outro profissional (enfermeiro ou farmacêutico).';
  END IF;
  IF NOT ((private.tenho_papel(pr.unidade_id, 'enfermeiro') IS TRUE AND private.paciente_em_cuidado_no_plantao(pr.paciente_id))
          OR private.tenho_papel(pr.unidade_id, 'farmaceutico') IS TRUE) THEN
    RAISE EXCEPTION 'A segunda conferência é de enfermeiro de plantão ou farmacêutico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.duplas_checagens SET segundo_por = v_eu, segundo_em = now() WHERE id = d.id;
  PERFORM private.registrar_auditoria('segunda_conferencia', 'prescricao_itens', it.id, pr.unidade_id,
    jsonb_build_object('horario', p_horario));
  RETURN 'segunda';
END $function$
;

CREATE OR REPLACE FUNCTION public.cuidados_enfermagem(p_paciente uuid, p_episodio uuid DEFAULT NULL::uuid, p_internacao uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  pa public.pacientes; v_ep uuid := p_episodio; v_int uuid := p_internacao; v_chave uuid; v_aberto boolean;
  v_plantao boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF private.pode_ler_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'O atendimento informado não é deste paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int AND i.paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'A internação informada não é deste paciente.';
  END IF;
  -- sem nenhum informado: o episódio aberto, ou a internação aberta
  IF v_ep IS NULL AND v_int IS NULL THEN
    SELECT e.id INTO v_ep FROM public.episodios e WHERE e.paciente_id = p_paciente AND e.etapa <> 'encerrado'
     ORDER BY e.chegada_em DESC LIMIT 1;
    IF v_ep IS NULL THEN
      SELECT i.id INTO v_int FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
       ORDER BY i.data_admissao DESC LIMIT 1;
    END IF;
  END IF;
  IF v_int IS NULL AND v_ep IS NOT NULL THEN
    SELECT x.id INTO v_int FROM public.internacoes x
     WHERE x.episodio_id = v_ep AND x.status IN ('admitido', 'em_observacao', 'internado') ORDER BY x.data_admissao DESC LIMIT 1;
  END IF;
  v_chave := coalesce(v_int, v_ep);
  v_aberto := CASE WHEN v_int IS NOT NULL THEN EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int
                                                         AND i.status IN ('admitido', 'em_observacao', 'internado'))
                   WHEN v_ep IS NOT NULL THEN EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.etapa <> 'encerrado')
                   ELSE false END;
  v_plantao := private.paciente_em_cuidado_no_plantao(p_paciente) IS TRUE;

  RETURN jsonb_build_object(
    'episodio_id', v_ep,
    'internacao_id', v_int,
    'atendimento_aberto', v_aberto,
    'pode_registrar', v_aberto AND v_plantao AND private.sou_enfermagem(pa.unidade_id) IS TRUE,
    'pode_sae', v_aberto AND v_plantao AND private.tenho_papel(pa.unidade_id, 'enfermeiro') IS TRUE,
    'sae', (
      SELECT jsonb_build_object('id', s.id, 'versao', s.versao, 'avaliacao', s.avaliacao, 'diagnosticos', s.diagnosticos,
                                'planejamento', s.planejamento, 'implementacao', s.implementacao, 'evolucao', s.evolucao,
                                'registrado_em', s.registrado_em, 'autor', pf.nome_completo)
        FROM public.sae_registros s LEFT JOIN public.perfis pf ON pf.id = s.registrado_por
       WHERE v_chave IS NOT NULL AND coalesce(s.internacao_id, s.episodio_id) = v_chave
       ORDER BY s.versao DESC LIMIT 1),
    'dispositivos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'tipo', d.tipo, 'local', d.local, 'calibre', d.calibre, 'inserido_em', d.inserido_em,
               'troca_prevista', d.troca_prevista, 'observacao', d.observacao, 'registrado_em', d.registrado_em,
               'autor', pf.nome_completo, 'dia', private.data_atual() - d.inserido_em + 1,
               'retirado_em', d.retirado_em, 'retirado_por', pr.nome_completo, 'motivo_retirada', d.motivo_retirada)
               ORDER BY (d.retirado_em IS NULL) DESC, d.inserido_em DESC, d.registrado_em DESC)
        FROM public.dispositivos_enfermagem d
        LEFT JOIN public.perfis pf ON pf.id = d.registrado_por
        LEFT JOIN public.perfis pr ON pr.id = d.retirado_por
       WHERE d.paciente_id = p_paciente AND (d.retirado_em IS NULL OR d.retirado_em > now() - interval '7 days')), '[]'::jsonb),
    'balanco', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', b.id, 'tipo', b.tipo, 'descricao', b.descricao, 'volume_ml', b.volume_ml, 'aferido_em', b.aferido_em,
               'autor', pf.nome_completo, 'cancelado_em', b.cancelado_em, 'cancelado_por', pc.nome_completo,
               'motivo_cancelamento', b.motivo_cancelamento)
               ORDER BY b.aferido_em DESC)
        FROM public.balanco_hidrico b
        LEFT JOIN public.perfis pf ON pf.id = b.registrado_por
        LEFT JOIN public.perfis pc ON pc.id = b.cancelado_por
       WHERE b.paciente_id = p_paciente AND b.aferido_em > now() - interval '48 hours'), '[]'::jsonb),
    'curativos', coalesce((
      SELECT jsonb_agg(x.j ORDER BY x.registrado_em DESC) FROM (
        SELECT c.registrado_em, jsonb_build_object(
                 'id', c.id, 'local', c.local, 'tipo', c.tipo, 'aspecto', c.aspecto, 'proxima_troca', c.proxima_troca,
                 'observacao', c.observacao, 'registrado_em', c.registrado_em, 'autor', pf.nome_completo) AS j
          FROM public.curativos_enfermagem c LEFT JOIN public.perfis pf ON pf.id = c.registrado_por
         WHERE c.paciente_id = p_paciente ORDER BY c.registrado_em DESC LIMIT 20) x), '[]'::jsonb),
    'sinais_vitais', coalesce((
      SELECT jsonb_agg(g.j ORDER BY g.quando DESC) FROM (
        SELECT date_trunc('minute', o.aferido_em) AS quando,
               jsonb_build_object('aferido_em', date_trunc('minute', o.aferido_em), 'autor', max(pf.nome_completo),
                                  'valores', jsonb_object_agg(c.nome, o.valor_num)) AS j
          FROM public.observacao o
          JOIN public.conceito c ON c.id = o.conceito_id
          LEFT JOIN public.perfis pf ON pf.id = o.registrado_por
         WHERE o.paciente_id = p_paciente AND o.aferido_em > now() - interval '48 hours' AND o.valor_num IS NOT NULL
           AND c.nome IN ('pressao-arterial-sistolica', 'pressao-arterial-diastolica', 'frequencia-cardiaca', 'frequencia-respiratoria',
                          'temperatura', 'saturacao-o2', 'escala-dor', 'glicemia-capilar', 'peso')
         GROUP BY date_trunc('minute', o.aferido_em), o.registrado_por
         ORDER BY 1 DESC LIMIT 8) g), '[]'::jsonb)
  );
END $function$
;

CREATE OR REPLACE FUNCTION public.fila_checagem()
 RETURNS TABLE(paciente_id uuid, paciente_nome text, local text, item_id uuid, tipo text, descricao text, dose text, via text, posologia text, se_necessario boolean, horarios text[], diluicao_texto text, vasoativo boolean, ultima_situacao text, ultima_em timestamp with time zone, ultima_por text, ultima_horario text, prescrito_em timestamp with time zone, por_horario jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    AND private.sou_enfermagem(pr.unidade_id) AND private.paciente_em_cuidado_no_plantao(pa.id)
  ORDER BY 2, it.ordem
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_suspeita_infeccao(p_paciente uuid, p_ativa boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_ep uuid; v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_ep := private.episodio_aberto(p_paciente);
  IF v_ep IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.episodios WHERE id = v_ep;
  IF NOT private.paciente_em_cuidado_no_plantao(p_paciente) THEN RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.'; END IF;
  IF private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN RAISE EXCEPTION 'A suspeita de infecção é marcada pelo médico.'; END IF;
  UPDATE public.episodios
     SET suspeita_infeccao_em = CASE WHEN p_ativa THEN coalesce(suspeita_infeccao_em, now()) END,
         suspeita_infeccao_por = CASE WHEN p_ativa THEN coalesce(suspeita_infeccao_por, private.meu_perfil_id()) END,
         updated_at = now()
   WHERE id = v_ep;
  PERFORM private.registrar_auditoria(CASE WHEN p_ativa THEN 'suspeita_infeccao' ELSE 'suspeita_infeccao_retirada' END,
    'episodios', v_ep, v_unidade, '{}'::jsonb);
END $function$
;

CREATE OR REPLACE FUNCTION public.prescrever(p_paciente uuid, p_item jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_alergia text;
  v_presc uuid; v_unidade uuid; v_nasc date; v_peso numeric; v_desde timestamptz; v_id uuid;
  v_tipo text := coalesce(p_item ->> 'tipo', 'medicamento');
  m public.medicamento; dv record; al record;
  v_dil_id uuid; v_dil_versao int; v_dil_texto text;
  v_via text := upper(nullif(btrim(p_item ->> 'via'), ''));
  v_dil_div text := nullif(btrim(p_item ->> 'diluicao_divergente'), '');
  -- Fase 2, tarefa 3: interação crítica pede justificativa
  v_inter jsonb;
  v_just_inter text := nullif(btrim(p_item ->> 'justificativa_interacao'), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT private.paciente_em_cuidado_no_plantao(p_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
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
    -- alergia trava o item (e nada a contorna): mesmo medicamento, mesmo
    -- princípio ativo ou a classe (ATC) dele — private.alergia_que_trava
    v_alergia := private.alergia_que_trava(p_paciente, m.id);
    IF v_alergia IS NOT NULL THEN
      RAISE EXCEPTION 'ALERGIA: o paciente tem alergia registrada a "%". Este item não foi prescrito.', v_alergia;
    END IF;
    -- pediatria: peso aferido no episódio
    -- criança (até 13a11m29d) ou idade desconhecida: peso aferido no episódio
    IF v_nasc IS NULL OR v_nasc > (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '14 years' THEN
      SELECT coalesce((SELECT chegada_em FROM public.episodios WHERE id = private.episodio_aberto(p_paciente)), now() - interval '24 hours') INTO v_desde;
      SELECT o.valor_num INTO v_peso FROM public.observacao o
        JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
       WHERE o.paciente_id = p_paciente AND o.aferido_em >= v_desde AND o.valor_num > 0
       ORDER BY o.aferido_em DESC LIMIT 1;
      IF v_peso IS NULL THEN
        RAISE EXCEPTION '%', CASE WHEN v_nasc IS NULL
          THEN 'Idade desconhecida: registre o peso aferido neste atendimento (ou a data de nascimento) antes de prescrever medicamento.'
          ELSE 'Criança: registre o peso aferido neste atendimento antes de prescrever medicamento.' END;
      END IF;
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

  -- Fase 2, tarefa 3: interação crítica ativa na unidade com item vigente
  IF v_tipo = 'medicamento' THEN
    v_inter := private.interacoes_com_prescricao(v_presc, m.id, v_unidade);
    IF jsonb_array_length(v_inter) > 0 AND (v_just_inter IS NULL OR length(v_just_inter) < 10) THEN
      RAISE EXCEPTION 'INTERAÇÃO CRÍTICA com %. Para prescrever mesmo assim, justifique (mínimo de 10 letras).',
        (SELECT string_agg((x ->> 'outro') || ' (' || (x ->> 'gravidade') || ')', '; ') FROM jsonb_array_elements(v_inter) x)
        USING DETAIL = v_inter::text, HINT = 'interacao_critica';
    END IF;
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
  IF jsonb_array_length(coalesce(v_inter, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.alertas_interacao (unidade_id, item_id, interacao_id, outro_item_id, justificativa, por)
    SELECT v_unidade, v_id, (x ->> 'interacao_id')::uuid, (x ->> 'outro_item_id')::uuid, v_just_inter, private.meu_perfil_id()
      FROM jsonb_array_elements(v_inter) x;
    PERFORM private.registrar_auditoria('prescrever_com_interacao', 'prescricao_itens', v_id, v_unidade,
      jsonb_build_object('interacoes', v_inter, 'justificativa', v_just_inter));
  END IF;
  RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.registrar_diagnostico(p_internacao uuid, p_tipo text, p_cid text, p_status text, p_tempo integer DEFAULT NULL::integer, p_tempo_unidade text DEFAULT NULL::text, p_episodio uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid; v_paciente uuid; v_internacao uuid; v_episodio uuid;
  v_cid text := private.cid_normalizado(p_cid);
  v_desc text;
  v_atual public.diagnosticos_episodio;
  v_id uuid;
  v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_internacao IS NOT NULL THEN
    SELECT i.unidade_id, i.paciente_id, i.id, i.episodio_id INTO v_unidade, v_paciente, v_internacao, v_episodio
      FROM public.internacoes i WHERE i.id = p_internacao AND i.status IN ('admitido', 'em_observacao', 'internado');
    IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada ou já encerrada.'; END IF;
  ELSIF p_episodio IS NOT NULL THEN
    SELECT e.unidade_id, e.paciente_id, e.id INTO v_unidade, v_paciente, v_episodio
      FROM public.episodios e WHERE e.id = p_episodio AND e.encerrado_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado ou já encerrado.'; END IF;
  ELSE
    RAISE EXCEPTION 'Informe a internação ou o atendimento.';
  END IF;
  IF NOT private.paciente_em_cuidado_no_plantao(v_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O diagnóstico é registrado pelo médico de plantão com o paciente.';
  END IF;

  IF p_tipo NOT IN ('primario', 'secundario') THEN RAISE EXCEPTION 'Tipo de diagnóstico inválido.'; END IF;
  IF p_status NOT IN ('hipotese', 'confirmado') THEN RAISE EXCEPTION 'Status: hipótese ou confirmado.'; END IF;
  IF v_cid IS NULL THEN RAISE EXCEPTION 'CID fora do formato (ex.: J18.9).'; END IF;
  -- com a tabela CID-10 carregada, o código tem de existir nela
  IF EXISTS (SELECT 1 FROM terminologia.cid10) THEN
    SELECT c.descricao INTO v_desc FROM terminologia.cid10 c
     WHERE c.codigo IN (v_cid, replace(v_cid, '.', '')) ORDER BY c.codigo = v_cid DESC LIMIT 1;
    IF v_desc IS NULL THEN RAISE EXCEPTION 'CID % não encontrado na CID-10.', v_cid; END IF;
  END IF;
  IF p_tempo IS NOT NULL THEN
    IF p_tipo <> 'primario' THEN RAISE EXCEPTION 'O tempo da doença vai no diagnóstico primário.'; END IF;
    IF p_tempo < 0 OR p_tempo > 999 THEN RAISE EXCEPTION 'Tempo da doença: até 3 números.'; END IF;
    IF p_tempo_unidade NOT IN ('horas', 'dias', 'meses', 'anos') OR p_tempo_unidade IS NULL THEN
      RAISE EXCEPTION 'Escolha a unidade do tempo da doença (horas, dias, meses ou anos).';
    END IF;
  END IF;

  SELECT * INTO v_atual FROM public.diagnosticos_episodio d
   WHERE coalesce(d.internacao_id, d.episodio_id) = coalesce(v_internacao, v_episodio)
     AND d.tipo = 'primario' AND d.encerrado_em IS NULL
   FOR UPDATE;

  IF p_tipo = 'secundario' THEN
    IF v_atual.id IS NULL THEN RAISE EXCEPTION 'Informe primeiro o diagnóstico primário.'; END IF;
    IF EXISTS (SELECT 1 FROM public.diagnosticos_episodio d
                WHERE coalesce(d.internacao_id, d.episodio_id) = coalesce(v_internacao, v_episodio)
                  AND d.cid = v_cid AND d.encerrado_em IS NULL) THEN
      RAISE EXCEPTION 'O CID % já está no diagnóstico.', v_cid;
    END IF;
    INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, internacao_id, episodio_id, tipo, cid, descricao, status, registrado_por)
    VALUES (v_unidade, v_paciente, v_internacao, v_episodio, 'secundario', v_cid, v_desc, p_status, v_eu)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- primário: igual ao vigente não grava nada
  IF v_atual.id IS NOT NULL AND v_atual.cid = v_cid AND v_atual.status = p_status
     AND v_atual.tempo_doenca IS NOT DISTINCT FROM p_tempo
     AND v_atual.tempo_unidade IS NOT DISTINCT FROM (CASE WHEN p_tempo IS NULL THEN NULL ELSE p_tempo_unidade END) THEN
    RETURN v_atual.id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.diagnosticos_episodio d
              WHERE coalesce(d.internacao_id, d.episodio_id) = coalesce(v_internacao, v_episodio)
                AND d.tipo = 'secundario' AND d.cid = v_cid AND d.encerrado_em IS NULL) THEN
    RAISE EXCEPTION 'O CID % está entre os secundários: retire-o antes de fazê-lo primário.', v_cid;
  END IF;
  IF v_atual.id IS NOT NULL THEN
    UPDATE public.diagnosticos_episodio
       SET encerrado_em = now(), encerrado_por = v_eu, encerramento = 'substituido'
     WHERE id = v_atual.id;
  END IF;
  INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, internacao_id, episodio_id, tipo, cid, descricao, status,
                                            tempo_doenca, tempo_unidade, registrado_por, substitui_id)
  VALUES (v_unidade, v_paciente, v_internacao, v_episodio, 'primario', v_cid, v_desc, p_status,
          p_tempo, CASE WHEN p_tempo IS NULL THEN NULL ELSE p_tempo_unidade END, v_eu, v_atual.id)
  RETURNING id INTO v_id;
  IF v_internacao IS NOT NULL THEN
    UPDATE public.internacoes SET cid_principal = v_cid WHERE id = v_internacao;
  END IF;
  RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.registrar_fugulin(p_internacao uuid, p_respostas jsonb, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  d jsonb := private.fugulin_definicao();
  i public.internacoes; pa public.pacientes;
  k text; v_total int := 0; v_cat text; f jsonb; v_dia date := private.data_atual();
  v_ant uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.data_alta IS NOT NULL OR i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'A internação não está ativa.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT private.paciente_em_cuidado_no_plantao(i.paciente_id) THEN
    RAISE EXCEPTION 'O Fugulin é do enfermeiro de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = i.paciente_id;
  IF pa.data_nascimento IS NOT NULL AND age(v_dia, pa.data_nascimento) < interval '14 years' THEN
    RAISE EXCEPTION 'Fugulin é instrumento do adulto: na criança não se usa (nada se converte do adulto).';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'Responda as 12 áreas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_respostas) LOOP
    IF NOT (d -> 'areas' ? k) THEN RAISE EXCEPTION 'Área que não é do Fugulin: %.', k; END IF;
  END LOOP;
  FOR k IN SELECT jsonb_array_elements_text(d -> 'areas') LOOP
    IF NOT (p_respostas ? k) OR jsonb_typeof(p_respostas -> k) <> 'number' OR (p_respostas ->> k)::numeric NOT IN (1, 2, 3, 4) THEN
      RAISE EXCEPTION 'Responda as 12 áreas com graduação de 1 a 4 (falta ou inválida: %).', k;
    END IF;
    v_total := v_total + (p_respostas ->> k)::int;
  END LOOP;
  FOR f IN SELECT * FROM jsonb_array_elements(d -> 'faixas') LOOP
    IF v_total >= (f ->> 0)::int THEN v_cat := f ->> 1; END IF;
  END LOOP;
  -- uma vigente por dia: a segunda do dia é retificação
  SELECT c.id INTO v_ant FROM public.classificacoes_fugulin c
   WHERE c.internacao_id = i.id AND c.dia = v_dia
     AND NOT EXISTS (SELECT 1 FROM public.classificacoes_fugulin r WHERE r.retifica_id = c.id)
   ORDER BY c.registrado_em DESC LIMIT 1;
  IF v_ant IS NOT NULL AND length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'O Fugulin de hoje já foi feito: para corrigir, diga o motivo (mínimo de 10 letras).';
  END IF;
  INSERT INTO public.classificacoes_fugulin (unidade_id, paciente_id, internacao_id, dia, versao, respostas, total, categoria,
                                             retifica_id, motivo, registrado_por)
  VALUES (i.unidade_id, i.paciente_id, i.id, v_dia, d ->> 'versao', p_respostas, v_total, v_cat,
          v_ant, CASE WHEN v_ant IS NOT NULL THEN btrim(p_motivo) END, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.registrar_intercorrencia(p_paciente uuid, p_episodio uuid, p_internacao uuid, p_tipo text, p_tipo_outro text, p_gravidade text, p_ocorrida_em timestamp with time zone, p_descricao text, p_conduta text, p_retifica uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  pa public.pacientes;
  v_papel text;
  v_setor uuid;
  v_id uuid;
  ant public.intercorrencias;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF pa.id IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  v_papel := CASE
    WHEN private.tenho_papel(pa.unidade_id, 'plantonista') IS TRUE THEN 'plantonista'
    WHEN private.tenho_papel(pa.unidade_id, 'enfermeiro') IS TRUE THEN 'enfermeiro'
    WHEN private.tenho_papel(pa.unidade_id, 'tecnico_enfermagem') IS TRUE THEN 'tecnico_enfermagem' END;
  IF v_papel IS NULL OR NOT private.paciente_em_cuidado_no_plantao(pa.id) THEN
    RAISE EXCEPTION 'A intercorrência é registrada por médico, enfermeiro ou técnico de enfermagem de plantão com o paciente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_episodio IS NULL AND p_internacao IS NULL THEN RAISE EXCEPTION 'Diga o atendimento ou a internação.'; END IF;
  IF p_episodio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = p_episodio AND paciente_id = pa.id) THEN
    RAISE EXCEPTION 'O atendimento não é deste paciente.';
  END IF;
  IF p_internacao IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes WHERE id = p_internacao AND paciente_id = pa.id) THEN
    RAISE EXCEPTION 'A internação não é deste paciente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tipos_intercorrencia WHERE codigo = p_tipo AND ativo) THEN RAISE EXCEPTION 'Tipo de intercorrência desconhecido.'; END IF;
  IF p_tipo = 'outra' AND length(btrim(coalesce(p_tipo_outro, ''))) < 3 THEN RAISE EXCEPTION 'Diga qual é a intercorrência.'; END IF;
  IF p_gravidade IS NULL OR p_gravidade NOT IN ('leve', 'moderada', 'grave') THEN RAISE EXCEPTION 'Escolha a gravidade.'; END IF;
  IF p_ocorrida_em IS NULL OR p_ocorrida_em > now() + interval '5 minutes' OR p_ocorrida_em < now() - interval '72 hours' THEN
    RAISE EXCEPTION 'Hora da intercorrência entre as últimas 72 horas e agora.';
  END IF;
  IF length(btrim(coalesce(p_descricao, ''))) < 10 THEN RAISE EXCEPTION 'Descreva o que aconteceu (mínimo de 10 letras).'; END IF;
  IF length(btrim(coalesce(p_conduta, ''))) < 5 THEN RAISE EXCEPTION 'Diga a conduta tomada.'; END IF;
  IF p_retifica IS NOT NULL THEN
    SELECT * INTO ant FROM public.intercorrencias WHERE id = p_retifica;
    IF ant.id IS NULL OR ant.paciente_id <> pa.id THEN RAISE EXCEPTION 'A intercorrência a retificar não é deste paciente.'; END IF;
    IF EXISTS (SELECT 1 FROM public.intercorrencias WHERE retifica_id = p_retifica) THEN
      RAISE EXCEPTION 'Esta intercorrência já foi retificada: retifique a versão mais nova.';
    END IF;
  END IF;
  v_setor := coalesce((SELECT i.setor_atual_id FROM public.internacoes i WHERE i.id = p_internacao),
                      (SELECT e.setor_id FROM public.episodios e WHERE e.id = p_episodio), pa.setor_id);
  INSERT INTO public.intercorrencias (unidade_id, paciente_id, episodio_id, internacao_id, setor_id, tipo, tipo_outro, gravidade,
                                      ocorrida_em, descricao, conduta, retifica_id, registrado_por, papel)
  VALUES (pa.unidade_id, pa.id, p_episodio, p_internacao, v_setor, p_tipo, nullif(btrim(coalesce(p_tipo_outro, '')), ''), p_gravidade,
          p_ocorrida_em, btrim(p_descricao), btrim(p_conduta), p_retifica, private.meu_perfil_id(), v_papel)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('registrar_intercorrencia', 'pacientes', pa.id, pa.unidade_id,
    jsonb_build_object('intercorrencia', v_id, 'tipo', p_tipo, 'gravidade', p_gravidade, 'retifica', p_retifica));
  RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.registrar_prescricao_itens(p_paciente uuid, p_observacoes text DEFAULT NULL::text, p_itens jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid;
  v_presc   uuid;
  v_medico  uuid;
  v_item    jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado.';
  END IF;

  IF NOT (
    private.eh_super_admin()
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR private.paciente_em_cuidado_no_plantao(p_paciente)  -- escala por setor (0011)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;

  -- Reutiliza a prescrição ativa existente ou cria nova
  SELECT id, medico_id INTO v_presc, v_medico
  FROM public.prescricoes
  WHERE paciente_id = p_paciente AND status = 'ativa'
  ORDER BY created_at DESC LIMIT 1;

  -- V3 (red-team 2026-10-01): não sobrescrever prescrição ativa de OUTRO médico.
  -- Só reutiliza se o chamador for o autor, gestor da unidade ou super admin.
  IF v_presc IS NOT NULL
     AND v_medico IS DISTINCT FROM auth.uid()
     AND NOT private.eh_super_admin()
     AND private.papel_na_unidade(v_unidade) <> 'gestor' THEN
    RAISE EXCEPTION 'A prescrição ativa deste paciente pertence a outro médico. Use o fluxo de prescrição para abrir a sua.';
  END IF;

  IF v_presc IS NULL THEN
    INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status, observacoes, criada_por)
    VALUES (v_unidade, p_paciente, auth.uid(), 'ativa', p_observacoes, auth.uid())
    RETURNING id INTO v_presc;
  ELSE
    UPDATE public.prescricoes SET observacoes = p_observacoes, updated_at = now() WHERE id = v_presc;
  END IF;

  -- Substitui os itens
  DELETE FROM public.prescricao_itens WHERE prescricao_id = v_presc;

  IF jsonb_array_length(p_itens) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
      INSERT INTO public.prescricao_itens (prescricao_id, descricao, dose, posologia, ordem, observacao)
      VALUES (v_presc,
              COALESCE(v_item->>'medicamento', v_item->>'descricao', ''),
              v_item->>'dose',
              v_item->>'posologia',
              COALESCE((v_item->>'ordem')::int, 1),
              v_item->>'observacao');
    END LOOP;
  END IF;

  RETURN v_presc;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_prescricao_observacao(p_paciente uuid, p_observacoes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid;
  v_presc uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado.';
  END IF;

  -- Só quem está na escala da unidade (ou gestor/super) pode prescrever
  IF NOT (
    private.eh_super_admin()
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR private.paciente_em_cuidado_no_plantao(p_paciente)  -- escala por setor (0011)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;

  INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status, observacoes, criada_por)
  VALUES (v_unidade, p_paciente, auth.uid(), 'ativa', p_observacoes, auth.uid())
  RETURNING id INTO v_presc;

  -- Item mínimo obrigatório da prescrição de observação
  INSERT INTO public.prescricao_itens (prescricao_id, descricao, ordem, observacao)
  VALUES (v_presc, 'Paciente em observação — conforme prescrição médica', 1, 'Observação por no máximo 6h');

  RETURN v_presc;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolver_exame(p_exame uuid, p_resultado text DEFAULT NULL::text, p_motivo_cancelamento text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.exames_pedidos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.exames_pedidos WHERE id = p_exame FOR UPDATE;
  IF NOT FOUND OR e.situacao <> 'pedido' THEN RAISE EXCEPTION 'Exame não encontrado ou já resolvido.'; END IF;
  IF NOT private.paciente_em_cuidado_no_plantao(e.paciente_id)
     OR NOT (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE OR private.sou_enfermagem(e.unidade_id)) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.';
  END IF;
  IF p_resultado IS NOT NULL AND length(btrim(p_resultado)) >= 1 THEN
    UPDATE public.exames_pedidos SET situacao = 'resultado', resultado = btrim(p_resultado), resolvido_por = private.meu_perfil_id(), resolvido_em = now()
     WHERE id = e.id;
  ELSIF length(btrim(coalesce(p_motivo_cancelamento, ''))) >= 10 THEN
    UPDATE public.exames_pedidos SET situacao = 'cancelado', motivo_cancelamento = btrim(p_motivo_cancelamento),
           resolvido_por = private.meu_perfil_id(), resolvido_em = now()
     WHERE id = e.id;
  ELSE
    RAISE EXCEPTION 'Registre o resultado, ou cancele com motivo (mínimo de 10 letras).';
  END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.retirar_diagnostico(p_diagnostico uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d public.diagnosticos_episodio;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.diagnosticos_episodio WHERE id = p_diagnostico FOR UPDATE;
  IF NOT FOUND OR d.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'Diagnóstico não encontrado ou já encerrado.'; END IF;
  IF NOT private.paciente_em_cuidado_no_plantao(d.paciente_id) OR private.tenho_papel(d.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O diagnóstico é registrado pelo médico de plantão com o paciente.';
  END IF;
  IF d.tipo = 'primario' THEN RAISE EXCEPTION 'O primário é obrigatório: troque-o por outro, não o retire.'; END IF;
  UPDATE public.diagnosticos_episodio
     SET encerrado_em = now(), encerrado_por = private.meu_perfil_id(), encerramento = 'retirado',
         motivo_encerramento = nullif(btrim(coalesce(p_motivo, '')), '')
   WHERE id = d.id;
END $function$
;

CREATE OR REPLACE FUNCTION public.suspender_item(p_item uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE it public.prescricao_itens; pr public.prescricoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item FOR UPDATE;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou já suspenso.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.paciente_em_cuidado_no_plantao(pr.paciente_id) OR private.tenho_papel(pr.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Suspender é do médico de plantão no setor do paciente.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Diga por que suspende.'; END IF;
  UPDATE public.prescricao_itens SET suspenso_em = now(), suspenso_por = private.meu_perfil_id(), motivo_suspensao = btrim(p_motivo)
   WHERE id = it.id;
END $function$
;

ALTER POLICY observacao_insert ON public.observacao WITH CHECK ((private.eh_super_admin() OR (private.papel_na_unidade(unidade_id) = 'gestor'::text) OR ((private.papel_na_unidade(unidade_id) = 'plantonista'::text) AND private.paciente_em_cuidado_no_plantao(paciente_id))));
ALTER POLICY prescricao_itens_delete ON public.prescricao_itens USING ((EXISTS ( SELECT 1
   FROM prescricoes p
  WHERE ((p.id = prescricao_itens.prescricao_id) AND (private.eh_super_admin() OR (private.papel_na_unidade(p.unidade_id) = 'gestor'::text) OR ((p.medico_id = private.meu_perfil_id()) AND (private.papel_na_unidade(p.unidade_id) = 'plantonista'::text) AND private.paciente_em_cuidado_no_plantao(p.paciente_id)))))));
ALTER POLICY prescricao_itens_update ON public.prescricao_itens USING ((EXISTS ( SELECT 1
   FROM prescricoes p
  WHERE ((p.id = prescricao_itens.prescricao_id) AND (private.eh_super_admin() OR (private.papel_na_unidade(p.unidade_id) = 'gestor'::text) OR ((p.medico_id = private.meu_perfil_id()) AND (private.papel_na_unidade(p.unidade_id) = 'plantonista'::text) AND private.paciente_em_cuidado_no_plantao(p.paciente_id)))))));
ALTER POLICY prescricoes_delete ON public.prescricoes USING ((private.eh_super_admin() OR (private.papel_na_unidade(unidade_id) = 'gestor'::text) OR ((medico_id = private.meu_perfil_id()) AND (private.papel_na_unidade(unidade_id) = 'plantonista'::text) AND private.paciente_em_cuidado_no_plantao(paciente_id))));
ALTER POLICY prescricoes_insert ON public.prescricoes WITH CHECK ((private.eh_super_admin() OR (private.papel_na_unidade(unidade_id) = 'gestor'::text) OR ((medico_id = private.meu_perfil_id()) AND (private.papel_na_unidade(unidade_id) = 'plantonista'::text) AND private.paciente_em_cuidado_no_plantao(paciente_id))));
ALTER POLICY prescricoes_update ON public.prescricoes USING ((private.eh_super_admin() OR (private.papel_na_unidade(unidade_id) = 'gestor'::text) OR ((medico_id = private.meu_perfil_id()) AND (private.papel_na_unidade(unidade_id) = 'plantonista'::text) AND private.paciente_em_cuidado_no_plantao(paciente_id)))) WITH CHECK ((private.eh_super_admin() OR (private.papel_na_unidade(unidade_id) = 'gestor'::text) OR ((medico_id = private.meu_perfil_id()) AND (private.papel_na_unidade(unidade_id) = 'plantonista'::text) AND private.paciente_em_cuidado_no_plantao(paciente_id))));

-- ── desfechos ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dar_alta(p_internacao uuid, p_tipo text, p_cid text, p_quando timestamp with time zone DEFAULT NULL::timestamp with time zone, p_justificativa text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_quando timestamptz := coalesce(p_quando, now());
  v_cid text := upper(btrim(coalesce(p_cid, '')));
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_imp jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação já encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'plantonista') IS NOT TRUE THEN RAISE EXCEPTION 'A alta é do médico.'; END IF;
  IF p_tipo NOT IN ('alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito') THEN
    RAISE EXCEPTION 'Tipo de alta inválido.';
  END IF;
  -- evasão: o paciente saiu sem avaliação final, então o CID é opcional
  -- (decisão do RT, 29/09/2026 — a mesma regra da porta); se vier, vale o formato
  IF v_cid = '' AND p_tipo = 'alta_evasao' THEN
    v_cid := NULL;
  ELSIF v_cid !~ '^[A-Z][0-9]{2}(\.?[0-9A-Z]{1,2})?$' THEN
    RAISE EXCEPTION 'Informe o CID de alta.';
  END IF;
  IF v_quando > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora da alta no futuro.'; END IF;
  IF v_quando < i.data_admissao THEN RAISE EXCEPTION 'Hora da alta antes da admissão.'; END IF;
  IF v_quando < now() - interval '30 minutes' AND length(btrim(coalesce(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Alta retroativa (mais de 30 minutos atrás): justifique (mínimo de 10 letras).';
  END IF;
  IF p_tipo IN ('alta_pedido', 'alta_evasao') AND length(btrim(coalesce(p_observacoes, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_tipo = 'transferencia_externa' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_tipo = 'obito' AND length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o número da Declaração de Óbito.';
  END IF;

  -- óbito e transferência externa não esperam o que ficou aberto (RT, 11/10/2026);
  -- só o agravo suspeito sem notificação continua impedindo
  IF p_tipo IN ('obito', 'transferencia_externa') THEN
    PERFORM private.encerrar_abertos_da_internacao(i, CASE p_tipo WHEN 'obito' THEN 'Óbito' ELSE 'Transferência externa' END);
  END IF;
  v_imp := private.impeditivos_alta(i.id);
  IF p_tipo IN ('obito', 'transferencia_externa') THEN
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_imp FROM jsonb_array_elements(v_imp) x WHERE x ->> 'tipo' <> 'documento';
  END IF;
  IF jsonb_array_length(v_imp) > 0 THEN
    RAISE EXCEPTION 'Existe(m) pendência(s) em aberto: %',
      (SELECT string_agg(x ->> 'descricao', '; ') FROM jsonb_array_elements(v_imp) x);
  END IF;

  PERFORM public.registrar_evento_adt(i.id, p_tipo, NULL, NULL, nullif(btrim(p_observacoes), ''),
    jsonb_build_object('cid', v_cid, 'quando', v_quando) || d);
  UPDATE public.internacoes
     SET data_alta = v_quando, cid_alta = v_cid, alta_por = v_perfil, alta_registrada_em = now(),
         alta_justificativa_retroativa = nullif(btrim(p_justificativa), ''),
         alta_observacoes = nullif(btrim(p_observacoes), ''),
         alta_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END
   WHERE id = i.id;
  UPDATE public.episodios SET encerrado_em = v_quando WHERE id = i.episodio_id;
  -- o paciente saiu: a prescrição para de valer e sai da checagem
  PERFORM private.encerrar_prescricoes(i.id, i.episodio_id, 'Encerrada com a alta da internação (' || p_tipo || ').');
  UPDATE public.pacientes SET setor_id = NULL, updated_at = now() WHERE id = i.paciente_id;
  INSERT INTO public.alta_paciente (paciente_id, unidade_id, status, criterios, justificativa, liberou_leito, criado_por)
  VALUES (i.paciente_id, i.unidade_id, 'concluida', jsonb_build_object('tipo', p_tipo, 'cid', v_cid, 'internacao_id', i.id),
          nullif(btrim(p_observacoes), ''), i.leito_atual_id IS NOT NULL, v_perfil);
END $function$;

CREATE OR REPLACE FUNCTION public.registrar_desfecho(p_episodio uuid, p_desfecho text, p_relato text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  e public.episodios;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_etapa text;
  v_setor uuid;
  v_leito uuid;
  v_internacao uuid;
  v_alta_em timestamptz;
  v_cid text;
  v_proc text;
  v_do text;
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
  -- hipótese diagnóstica (protótipo: "Informe a hipótese diagnóstica na aba Atendimento")
  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros
                                             WHERE episodio_id = e.id AND length(btrim(coalesce(avaliacao, ''))) > 0) THEN
    RAISE EXCEPTION 'Informe a hipótese diagnóstica (Avaliação) no registro do atendimento.';
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

  -- dados da alta (protótipo altaErro, manual 3.17)
  IF nullif(btrim(d ->> 'alta_em'), '') IS NOT NULL THEN
    BEGIN
      v_alta_em := (d ->> 'alta_em')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Data e hora da alta inválidas.';
    END;
    IF v_alta_em > now() + interval '1 minute' THEN RAISE EXCEPTION 'Data e hora da alta no futuro.'; END IF;
    IF v_alta_em < e.chegada_em THEN RAISE EXCEPTION 'Data e hora da alta antes da chegada do paciente.'; END IF;
    IF v_alta_em < now() - interval '30 minutes'
       AND length(btrim(coalesce(d ->> 'justificativa_retroativa', ''))) < 10 THEN
      RAISE EXCEPTION 'Alta retroativa: justifique (mínimo de 10 letras).';
    END IF;
    d := d || jsonb_build_object('alta_em', v_alta_em, 'retroativa', v_alta_em < now() - interval '30 minutes');
  END IF;
  IF p_desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'obito') THEN
    v_cid := coalesce(nullif(btrim(d ->> 'cid_alta'), ''),
                      (SELECT s.cid FROM public.atendimento_registros s
                        WHERE s.episodio_id = e.id AND s.cid IS NOT NULL ORDER BY s.criado_em DESC LIMIT 1));
    IF v_cid IS NULL THEN RAISE EXCEPTION 'Informe o diagnóstico de alta (CID).'; END IF;
    IF private.cid_normalizado(v_cid) IS NULL THEN RAISE EXCEPTION 'Diagnóstico de alta: CID em formato inválido (ex.: J45.9).'; END IF;
    d := d || jsonb_build_object('cid_alta', private.cid_normalizado(v_cid));
  END IF;
  v_proc := nullif(regexp_replace(coalesce(d ->> 'procedimento', ''), '\D', '', 'g'), '');
  IF v_proc IS NOT NULL THEN
    IF v_proc !~ '^\d{10}$' THEN RAISE EXCEPTION 'Procedimento SIGTAP: código de 10 dígitos.'; END IF;
    IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento)
       AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) THEN
      RAISE EXCEPTION 'Procedimento SIGTAP não encontrado na tabela vigente.';
    END IF;
    d := d || jsonb_build_object('procedimento', v_proc);
  END IF;
  IF p_desfecho = 'obito' THEN
    d := d || jsonb_build_object('setor_obito', coalesce(nullif(btrim(d ->> 'setor_obito'), ''),
                                                        (SELECT nome FROM public.setores WHERE id = e.setor_id)));
    IF private.cid_normalizado(d ->> 'cid_obito') IS NULL THEN RAISE EXCEPTION 'Óbito: informe o CID do óbito.'; END IF;
    v_do := regexp_replace(coalesce(d ->> 'numero_do', ''), '\D', '', 'g');
    IF v_do !~ '^\d{6,12}$' THEN RAISE EXCEPTION 'Óbito: o número da Declaração de Óbito tem de 6 a 12 dígitos.'; END IF;
    d := d || jsonb_build_object('cid_obito', private.cid_normalizado(d ->> 'cid_obito'), 'numero_do', v_do);
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
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status IN ('livre', 'reservado')) THEN
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
         reavaliar_em = NULL,
         updated_at = now()
   WHERE id = e.id;
  -- Parecer órfão (decisão do RT 03/10/2026): ao encerrar o atendimento da
  -- porta, os pareceres ainda abertos deste episódio são cancelados com motivo
  -- (quando o paciente vai para observação ou internação, o parecer segue o
  -- paciente, então só cancela nos desfechos que encerram).
  IF v_etapa = 'encerrado' THEN
    -- o paciente saiu: a prescrição para de valer e sai da checagem
    PERFORM private.encerrar_prescricoes(NULL, e.id, 'Encerrada com o desfecho do pronto-socorro (' || p_desfecho || ').');
    -- óbito e transferência: exame sem resultado é cancelado com o motivo (RT, 11/10/2026)
    IF p_desfecho IN ('obito', 'transferencia') THEN
      PERFORM private.cancelar_exames_pedidos(NULL, e.id,
        CASE p_desfecho WHEN 'obito' THEN 'Óbito' ELSE 'Transferência externa' END || ': exame cancelado sem resultado.');
    END IF;
    PERFORM private.cancelar_pareceres_do_episodio(e, private.meu_perfil_id(),
      'Atendimento do pronto-socorro encerrado (' || p_desfecho || ') com o parecer ainda pendente.');
  END IF;
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id;
  PERFORM private.registrar_auditoria('desfecho', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', v_etapa, 'tipo', p_desfecho));
END $function$;

CREATE OR REPLACE FUNCTION public.finalizar_observacao(p_internacao uuid, p_desfecho text, p_cid text DEFAULT NULL::text, p_relato text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_relato text := nullif(btrim(coalesce(p_relato, '')), '');
  v_tipo text;
  v_setor uuid;
  v_leito uuid;
  v_hora timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  IF p_desfecho NOT IN ('alta_medica', 'alta_apos_medicacao', 'internacao', 'transferencia', 'evasao', 'alta_a_pedido', 'obito') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;
  -- no óbito e na transferência a passagem é retirada junto com o desfecho (dar_alta)
  IF p_desfecho NOT IN ('obito', 'transferencia')
     AND EXISTS (SELECT 1 FROM public.passagens_plantao WHERE internacao_id = i.id AND situacao = 'aguardando') THEN
    RAISE EXCEPTION 'Há passagem de plantão aguardando aceite. Retire a passagem antes de finalizar.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(coalesce(v_relato, '')) < 15 THEN
    RAISE EXCEPTION '%', CASE p_desfecho
      WHEN 'evasao' THEN 'Como e quando foi percebida a evasão: escreva ao menos 15 letras.'
      WHEN 'alta_a_pedido' THEN 'Riscos explicados e termo assinado: escreva ao menos 15 letras.'
      ELSE 'Circunstâncias do óbito e medidas realizadas: escreva ao menos 15 letras.' END;
  END IF;
  d := d || jsonb_build_object('desfecho_observacao', p_desfecho);

  -- quem sai da observação sai do protocolo junto
  UPDATE public.observacao_protocolos
     SET encerrado_em = now(), encerrado_por = private.meu_perfil_id(),
         motivo_encerramento = 'Encerrado com o desfecho da observação'
   WHERE internacao_id = i.id AND encerrado_em IS NULL;

  IF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = i.unidade_id
                                        AND ativo AND (tipo IN ('internacao', 'uti', 'isolamento')
                                          OR (tipo = 'observacao' AND position('verm' in lower(nome)) > 0))) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status IN ('livre', 'reservado')) THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    PERFORM public.registrar_evento_adt(i.id, 'internacao', v_setor, v_leito, coalesce(v_relato, 'Desfecho da observação'), d);
    UPDATE public.pacientes SET setor_id = v_setor, updated_at = now() WHERE id = i.paciente_id;
    RETURN;
  END IF;

  v_tipo := CASE p_desfecho
    WHEN 'alta_medica' THEN 'alta_melhorada'
    WHEN 'alta_apos_medicacao' THEN 'alta_melhorada'
    WHEN 'transferencia' THEN 'transferencia_externa'
    WHEN 'evasao' THEN 'alta_evasao'
    WHEN 'alta_a_pedido' THEN 'alta_pedido'
    ELSE 'obito' END;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o serviço de destino.';
  END IF;
  IF p_desfecho = 'obito' THEN
    v_hora := nullif(d ->> 'hora_obito', '')::timestamptz;
    IF v_hora IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF v_hora > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF v_hora < i.data_admissao THEN RAISE EXCEPTION 'Hora do óbito antes da entrada.'; END IF;
  END IF;
  -- a alta é registrada agora; a hora do óbito vai nos detalhes, como na porta
  PERFORM public.dar_alta(i.id, v_tipo, p_cid, NULL, NULL, v_relato, d);
END $function$;

CREATE OR REPLACE FUNCTION public.cancelar_alta(p_internacao uuid, p_justificativa text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  ev public.eventos_adt;
  v_status text;
  v_leito uuid;
  v_status_leito public.status_leito;
  v_estado jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status IN ('admitido', 'em_observacao', 'internado') OR i.alta_registrada_em IS NULL THEN
    RAISE EXCEPTION 'Não há alta para cancelar.';
  END IF;
  IF NOT (i.alta_por = v_perfil OR private.papel_na_unidade(i.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Só quem deu a alta, ou o gestor, cancela.';
  END IF;
  IF i.alta_registrada_em < now() - interval '24 hours' THEN RAISE EXCEPTION 'A alta tem mais de 24 horas: fale com o gestor.'; END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 10 THEN RAISE EXCEPTION 'Justifique o cancelamento (mínimo de 10 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes WHERE paciente_id = i.paciente_id AND id <> i.id
               AND status IN ('admitido', 'em_observacao', 'internado')) THEN
    RAISE EXCEPTION 'O paciente já tem outra internação ativa.';
  END IF;

  SELECT * INTO ev FROM public.eventos_adt WHERE internacao_id = i.id ORDER BY seq DESC LIMIT 1;
  v_status := coalesce(ev.estado_antes ->> 'status', 'internado');
  v_leito := nullif(ev.estado_antes ->> 'leito', '')::uuid;
  -- o leito volta se ainda não foi ocupado por outro
  IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND status IN ('livre', 'higienizacao')) THEN
    v_leito := NULL;
  END IF;

  v_estado := jsonb_build_object('status', v_status, 'setor', i.setor_atual_id, 'leito', v_leito);
  INSERT INTO public.eventos_adt (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento, estado_antes, estado_depois,
    leito_destino_id, setor_destino_id, autor_id, motivo, hash_previo, hash_conteudo)
  VALUES (ev.seq + 1, i.organizacao_id, i.unidade_id, i.id, i.paciente_id, 'cancelamento_alta', ev.estado_depois, v_estado,
    v_leito, i.setor_atual_id, v_perfil, btrim(p_justificativa), ev.hash_conteudo,
    private.hash_evento(ev.seq + 1, 'cancelamento_alta', v_estado, v_perfil, btrim(p_justificativa), ev.hash_conteudo));

  UPDATE public.internacoes
     SET status = v_status, leito_atual_id = v_leito, data_alta = NULL, cid_alta = NULL, alta_por = NULL,
         alta_registrada_em = NULL, alta_justificativa_retroativa = NULL, alta_observacoes = NULL, alta_detalhes = NULL,
         updated_at = now()
   WHERE id = i.id;
  IF v_leito IS NOT NULL THEN
    -- o paciente volta ao leito que deixou: única ocupação permitida a partir
    -- de 'higienizacao' (trava em private.leito_transicao)
    SELECT l.status INTO v_status_leito FROM public.leitos l WHERE l.id = v_leito FOR UPDATE;
    PERFORM set_config('cc.leito_retorno', 'on', true);
    UPDATE public.leitos SET status = 'ocupado' WHERE id = v_leito;
    PERFORM set_config('cc.leito_retorno', 'off', true);
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito, i.unidade_id, 'ocupacao', v_status_leito, 'ocupado', i.id, v_perfil, 'Alta cancelada');
  END IF;
  UPDATE public.pacientes SET setor_id = i.setor_atual_id, updated_at = now() WHERE id = i.paciente_id;
  -- as prescrições encerradas por esta alta voltam a valer
  UPDATE public.prescricoes
     SET status = 'ativa', encerrada_em = NULL, encerrada_por = NULL, motivo_encerramento = NULL, updated_at = now()
   WHERE status = 'encerrada' AND encerrada_em >= i.alta_registrada_em
     AND (internacao_id = i.id OR (i.episodio_id IS NOT NULL AND episodio_id = i.episodio_id));
  UPDATE public.pacotes_alta SET situacao = 'revogado', revogado_em = now(), revogado_por = v_perfil
   WHERE internacao_id = i.id AND situacao = 'ativo';
  UPDATE public.alta_paciente SET status = 'cancelada', justificativa = coalesce(justificativa || ' · ', '') || 'Cancelada: ' || btrim(p_justificativa), updated_at = now()
   WHERE paciente_id = i.paciente_id AND criterios ->> 'internacao_id' = i.id::text AND status = 'concluida';
END $function$;

-- ── dados já gravados: prescrição ativa de quem já saiu ──────────────────────
-- (na produção, em 11/10/2026, não havia nenhuma; vale para os outros ambientes)
UPDATE public.prescricoes pr
   SET status = 'encerrada', encerrada_em = now(), updated_at = now(),
       motivo_encerramento = 'Encerrada na correção de 11/10/2026: o paciente já tinha saído.'
 WHERE pr.status = 'ativa'
   AND (EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = pr.internacao_id AND i.data_alta IS NOT NULL)
        OR (pr.internacao_id IS NULL AND EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = pr.episodio_id AND e.etapa = 'encerrado')));
