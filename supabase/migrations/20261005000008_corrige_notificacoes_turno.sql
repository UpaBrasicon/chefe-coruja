-- ════════════════════════════════════════════════════════════════════════════
-- Correção: gerar_notificacoes_turno (20260815000024) falhava com
-- «column reference "tipo" is ambiguous» (42702): o ON CONFLICT (…, tipo)
-- colide com a coluna de retorno tipo do RETURNS TABLE. Acontece para quem
-- está escalado em setor de observação (o ramo do aviso de observação), e o
-- aviso de turno não era gerado. Mesma função, com #variable_conflict
-- use_column (as referências sem prefixo são às colunas; as variáveis da
-- função têm prefixo v_). O primeiro erro escondia um segundo, no aviso A2
-- (observação vencendo): o laço usava p.created_at, mas `p` só existe na
-- consulta do laço; agora a consulta traz created_at e o laço lê
-- v_pac.created_at. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.gerar_notificacoes_turno(p_unidade uuid)
 RETURNS TABLE(id uuid, tipo text, mensagem text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE
  v_hora   time;
  v_turno  text;
  v_tipo   text;
  v_msg    text;
  v_pac    RECORD;
BEGIN
  IF NOT private.na_escala_agora(p_unidade) AND NOT private.eh_super_admin() THEN
    RETURN;
  END IF;

  v_hora := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_turno := private.turno_atual();

  -- Avisos fixos de turno (noite 19:30/20:00, manhã 07:30/08:00)
  IF v_turno = 'noite' THEN
    IF v_hora >= time '19:30' AND v_hora < time '19:59' THEN
      v_tipo := 'noite_1930';
      v_msg := 'Você é o plantonista da noite. Confira os pacientes internados e em observação que estão sob sua responsabilidade.';
    ELSIF v_hora >= time '20:00' THEN
      v_tipo := 'noite_2000';
      v_msg := 'Plantão noturno em andamento. Verifique os pacientes internados e em observação da sua escala.';
    END IF;
  END IF;

  IF v_turno = 'manha' THEN
    IF v_hora >= time '07:30' AND v_hora < time '07:59' THEN
      v_tipo := 'manha_0730';
      v_msg := 'Bom dia! Assuma os pacientes internados e em observação do plantão da manhã.';
    ELSIF v_hora >= time '08:00' THEN
      v_tipo := 'manha_0800';
      v_msg := 'Plantão da manhã em andamento. Confira os pacientes internados e em observação.';
    END IF;
  END IF;

  IF v_tipo IS NOT NULL THEN
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (auth.uid(), p_unidade, private.data_atual(), v_tipo, v_msg)
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END IF;

  -- A2: observação vencendo (faltam 30min ou 15min para 6h) — por paciente
  IF v_turno IN ('manha', 'tarde', 'noite') THEN
    FOR v_pac IN
      SELECT p.id AS paciente_id, p.nome, p.created_at
      FROM public.pacientes p
      WHERE p.unidade_id = p_unidade AND p.ativo
        AND p.setor_id IN (SELECT private.setores_na_escala_agora())
        AND p.setor_id IN (
          SELECT s.id FROM public.setores s
          WHERE s.tipo = 'observacao' AND position('verm' in lower(s.nome)) = 0
        )
    LOOP
      -- Janelas: aos 5h30 e 5h45 de observação
      IF (now() - v_pac.created_at) BETWEEN interval '5 hours 30 minutes' AND interval '5 hours 45 minutes' THEN
        INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
        VALUES (auth.uid(), p_unidade, private.data_atual(), 'obs_30min_' || v_pac.paciente_id,
                'Paciente ' || v_pac.nome || ' completa 6h de observação em 30 minutos. Internar ou liberar.')
        ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      ELSIF (now() - v_pac.created_at) BETWEEN interval '5 hours 45 minutes' AND interval '6 hours' THEN
        INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
        VALUES (auth.uid(), p_unidade, private.data_atual(), 'obs_15min_' || v_pac.paciente_id,
                'Paciente ' || v_pac.nome || ' completa 6h de observação em 15 minutos. Internar ou liberar.')
        ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- A3: reaviso de decisão pendente (sair do fixo / passagem / justificativa)
  FOR v_pac IN
    SELECT s.tipo AS st, s.id AS sid
    FROM public.solicitacoes_escala s
    WHERE s.perfil_id = auth.uid() AND s.unidade_id = p_unidade AND s.status = 'pendente'
  LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (auth.uid(), p_unidade, private.data_atual(),
            'solic_pendente_' || v_pac.sid,
            'Sua solicitação (' || v_pac.st || ') ainda aguarda decisão do gestor.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;

  -- A4: aviso de candidatura aprovada/recusada
  FOR v_pac IN
    SELECT c.id AS cid, c.status AS cstatus, c.setor_id AS csetor
    FROM public.candidaturas_escala c
    WHERE c.perfil_id = auth.uid() AND c.unidade_id = p_unidade
      AND c.status <> 'pendente'
      AND c.updated_at > now() - interval '24 hours'
  LOOP
    IF v_pac.cstatus = 'aprovado' THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      VALUES (auth.uid(), p_unidade, private.data_atual(), 'cand_aprovada_' || v_pac.cid,
              'Parabéns! Sua candidatura a um plantão foi APROVADA.')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    ELSIF v_pac.cstatus = 'recusado' THEN
      INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
      VALUES (auth.uid(), p_unidade, private.data_atual(), 'cand_recusada_' || v_pac.cid,
              'Sua candidatura a um plantão foi recusada.')
      ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT n.id, n.tipo, n.mensagem, n.created_at
    FROM public.notificacoes_plantonista n
    WHERE n.perfil_id = auth.uid()
      AND n.unidade_id = p_unidade
      AND n.data = private.data_atual()
      AND n.lida_em IS NULL
    ORDER BY n.created_at;
END;
$function$;
