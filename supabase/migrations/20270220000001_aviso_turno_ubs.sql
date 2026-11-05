-- ════════════════════════════════════════════════════════════════════════════
-- F5-T1 (portão da Fase 5, 04/11/2026): na UBS aparecia o aviso "Plantão
-- noturno em andamento. Verifique os pacientes internados e em observação".
-- Os quatro avisos fixos de turno (manhã 07:30/08:00, noite 19:30/20:00) falam
-- de internados e observação, que a UBS não tem.
--
-- 1. private.aviso_fixo_turno(unidade, hora, turno): os mesmos quatro avisos,
--    com os mesmos textos e horários, e nenhum quando a unidade é UBS.
-- 2. public.gerar_notificacoes_turno passa a usar a função. Nada mais muda:
--    assinatura, SECURITY DEFINER, search_path e grants ficam os mesmos.
--
-- Idempotente (CREATE OR REPLACE). Avisos já gravados hoje numa UBS ficam até
-- serem lidos.
-- Teste: supabase/tests/f5_aviso_turno_ubs.sql.
--
-- Rollback (na ordem):
--   1. recriar public.gerar_notificacoes_turno como em
--      20270209000011_menores_revisao.sql (md5 do corpo ed96e25a79daf7647467c2c8a64fa6cd);
--   2. DROP FUNCTION private.aviso_fixo_turno(uuid, time, text);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.aviso_fixo_turno(p_unidade uuid, p_hora time, p_turno text,
  OUT tipo text, OUT mensagem text)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  -- F5-T1: a UBS não tem internação nem observação, e esses avisos são da
  -- passagem de plantão da UPA e do hospital.
  IF (SELECT u.tipo::text FROM public.unidades u WHERE u.id = p_unidade) = 'ubs' THEN
    RETURN;
  END IF;

  IF p_turno = 'noite' THEN
    IF p_hora >= time '19:30' AND p_hora < time '19:59' THEN
      tipo := 'noite_1930';
      mensagem := 'Você é o plantonista da noite. Confira os pacientes internados e em observação que estão sob sua responsabilidade.';
    ELSIF p_hora >= time '20:00' THEN
      tipo := 'noite_2000';
      mensagem := 'Plantão noturno em andamento. Verifique os pacientes internados e em observação da sua escala.';
    END IF;
  END IF;

  IF p_turno = 'manha' THEN
    IF p_hora >= time '07:30' AND p_hora < time '07:59' THEN
      tipo := 'manha_0730';
      mensagem := 'Bom dia! Assuma os pacientes internados e em observação do plantão da manhã.';
    ELSIF p_hora >= time '08:00' THEN
      tipo := 'manha_0800';
      mensagem := 'Plantão da manhã em andamento. Confira os pacientes internados e em observação.';
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.aviso_fixo_turno(uuid, time, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gerar_notificacoes_turno(p_unidade uuid)
 RETURNS TABLE(id uuid, tipo text, mensagem text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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

  -- Avisos fixos de turno (noite 19:30/20:00, manhã 07:30/08:00); na UBS, nenhum
  SELECT a.tipo, a.mensagem INTO v_tipo, v_msg FROM private.aviso_fixo_turno(p_unidade, v_hora, v_turno) a;

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
        SELECT auth.uid(), p_unidade, private.data_atual(), 'obs_30min_' || v_pac.paciente_id,
                'Paciente ' || v_pac.nome || ' completa 6h de observação em 30 minutos. Internar ou liberar.' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = 'obs_30min_' || v_pac.paciente_id AND n0.created_at > now() - interval '1 hour')
        ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
      ELSIF (now() - v_pac.created_at) BETWEEN interval '5 hours 45 minutes' AND interval '6 hours' THEN
        INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
        SELECT auth.uid(), p_unidade, private.data_atual(), 'obs_15min_' || v_pac.paciente_id,
                'Paciente ' || v_pac.nome || ' completa 6h de observação em 15 minutos. Internar ou liberar.' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = 'obs_15min_' || v_pac.paciente_id AND n0.created_at > now() - interval '1 hour')
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
      AND (n.data = private.data_atual() OR (n.tipo LIKE 'obs\_%' AND n.created_at > now() - interval '1 hour'))
      AND n.lida_em IS NULL
    ORDER BY n.created_at;
END;
$$;
