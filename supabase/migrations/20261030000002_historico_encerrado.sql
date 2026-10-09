-- Fase 1, tarefa 8 do BACKLOG.md — histórico encerrado inline no prontuário.
--
-- Decisões do RT (08/10/2026):
--   • quem CUIDA do paciente agora — o médico com o paciente no setor do seu
--     plantão (porta, observação ou internação) e o médico da teleinterconsulta
--     vigente — vê, sem pedido ao gestor, o RESUMO dos atendimentos encerrados
--     do paciente NESTA unidade, sem limite de tempo: data, setor, cor, CID,
--     desfecho e médico responsável; nada de texto clínico;
--   • o DETALHE (evoluções, prescrições, documentos) abre com MOTIVO escrito
--     (mínimo de 10 letras), na hora, só leitura, por 12 horas; quem, quando e o
--     motivo ficam no registro de acesso, que o gestor vê na Auditoria;
--   • quem não cuida do paciente continua com o pedido ao gestor (Fase 6).
-- O detalhe reaproveita as políticas de leitura do pedido aprovado:
-- acesso_encerrado_vigente passa a aceitar também o acesso por motivo.
-- Só aditiva: tabela e funções novas, coluna nova (motivo) no registro de
-- acesso; acessos_prontuario_da_unidade devolve o motivo (DROP + CREATE).
--
-- ROLLBACK: reaplicar acesso_encerrado_vigente de 20261001000001 e
--   acessos_prontuario_da_unidade de 20261001000002; DROP FUNCTION
--   public.historico_encerrado, public.abrir_historico_encerrado,
--   private.cuida_do_paciente_agora; DROP TABLE private.acessos_historico
--   (o registro de acesso fica: é trilha legal).

-- ── quem cuida agora ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.cuida_do_paciente_agora(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
     WHERE pa.id = p_paciente
       AND private.papel_na_unidade(pa.unidade_id) = 'plantonista'
       AND private.paciente_no_meu_plantao(pa.id))
  OR coalesce(private.teleinterconsulta_vigente(p_paciente), false);
$$;
REVOKE ALL ON FUNCTION private.cuida_do_paciente_agora(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.cuida_do_paciente_agora(uuid) TO authenticated;

-- ── acesso ao detalhe por motivo (12 h, só leitura) ─────────────────────────
CREATE TABLE IF NOT EXISTS private.acessos_historico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id),
  motivo      text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  valido_ate  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS acessos_historico_vigente ON private.acessos_historico (perfil_id, paciente_id, valido_ate);
REVOKE ALL ON private.acessos_historico FROM PUBLIC, anon, authenticated;

ALTER TABLE public.log_acesso_prontuario ADD COLUMN IF NOT EXISTS motivo text;

CREATE OR REPLACE FUNCTION private.acesso_encerrado_vigente(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pedidos_acesso_prontuario pd
    WHERE pd.paciente_id = p_paciente
      AND pd.solicitante_id = private.meu_perfil_id()
      AND pd.status = 'aprovado'
      AND pd.valido_ate > now()
      -- o vínculo precisa continuar ativo na unidade
      AND private.papel_na_unidade(pd.unidade_id) <> ''
  ) OR EXISTS (
    -- Fase 1, tarefa 8: detalhe aberto com motivo por quem cuida do paciente
    SELECT 1 FROM private.acessos_historico ah
    WHERE ah.paciente_id = p_paciente
      AND ah.perfil_id = private.meu_perfil_id()
      AND ah.valido_ate > now()
      AND private.papel_na_unidade(ah.unidade_id) <> ''
  );
$$;

-- ── resumo dos atendimentos encerrados ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.historico_encerrado(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid;
  v_cuida   boolean;
  v_res     jsonb;
  v_ator    uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  v_cuida := private.cuida_do_paciente_agora(p_paciente);
  IF v_unidade IS NULL OR NOT (v_cuida OR private.gestor_da_unidade(v_unidade) OR private.acesso_encerrado_vigente(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado: o histórico aparece para quem cuida do paciente agora.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    'pode_abrir_detalhe', v_cuida,
    'detalhe_liberado_ate', (SELECT max(ah.valido_ate) FROM private.acessos_historico ah
                              WHERE ah.paciente_id = p_paciente AND ah.perfil_id = v_ator AND ah.valido_ate > now()),
    'atendimentos', coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'chegada_em', x.chegada_em, 'encerrado_em', x.encerrado_em, 'setor', x.setor,
        'cor', x.cor, 'desfecho', x.desfecho, 'cid', x.cid, 'medico', x.medico)
      ORDER BY x.chegada_em DESC), '[]'::jsonb))
    INTO v_res
    FROM (
      SELECT e.id, e.chegada_em,
             coalesce(i.data_alta, e.encerrado_em) AS encerrado_em,
             coalesce(si.nome, s.nome) AS setor,
             e.cor_atual AS cor,
             -- o desfecho final: o da internação/observação quando o atendimento seguiu para lá
             CASE WHEN i.status IS NOT NULL AND i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN i.status
                  ELSE e.desfecho END AS desfecho,
             nullif(coalesce(i.cid_alta, e.desfecho_detalhes ->> 'cid_alta', i.cid_principal), '') AS cid,
             coalesce(pm.nome_completo, pd.nome_completo) AS medico
        FROM public.episodios e
        JOIN public.setores s ON s.id = e.setor_id
        LEFT JOIN LATERAL (
          SELECT x.* FROM public.internacoes x WHERE x.episodio_id = e.id ORDER BY x.created_at DESC LIMIT 1) i ON true
        LEFT JOIN public.setores si ON si.id = i.setor_atual_id
        LEFT JOIN public.perfis pm ON pm.id = e.atendimento_medico_id
        LEFT JOIN public.perfis pd ON pd.id = e.desfecho_por
       WHERE e.paciente_id = p_paciente
         AND e.unidade_id = v_unidade
         AND e.etapa = 'encerrado'
         -- a internação que ainda corre não é histórico encerrado
         AND (i.status IS NULL OR i.status NOT IN ('admitido', 'em_observacao', 'internado'))
       ORDER BY e.chegada_em DESC
       LIMIT 200) x;

  -- resumo de paciente para quem não é da escala do setor de origem: fica na trilha (15 min)
  IF jsonb_array_length(v_res -> 'atendimentos') > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.entidade_id = p_paciente AND a.acao = 'ver_historico_resumo'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_historico_resumo', 'pacientes', p_paciente, v_unidade,
      jsonb_build_object('atendimentos', jsonb_array_length(v_res -> 'atendimentos')));
  END IF;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.historico_encerrado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.historico_encerrado(uuid) TO authenticated;

-- ── abrir o detalhe com motivo ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.abrir_historico_encerrado(p_paciente uuid, p_motivo text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_pac   public.pacientes;
  v_ator  uuid := private.meu_perfil_id();
  v_ate   timestamptz := now() + interval '12 hours';
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v_pac FROM public.pacientes WHERE id = p_paciente;
  IF v_pac.id IS NULL OR NOT private.cuida_do_paciente_agora(p_paciente) THEN
    RAISE EXCEPTION 'Só quem cuida do paciente agora abre o histórico com motivo; os demais fazem o pedido ao gestor.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Escreva o motivo para abrir o histórico (mínimo de 10 letras).';
  END IF;
  INSERT INTO private.acessos_historico (unidade_id, paciente_id, perfil_id, motivo, valido_ate)
  VALUES (v_pac.unidade_id, p_paciente, v_ator, btrim(p_motivo), v_ate);
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso, motivo, ip, user_agent)
  SELECT u.organizacao_id, u.id, p_paciente, v_ator, nullif(private.papel_na_unidade(u.id), ''), 'leitura_prontuario', btrim(p_motivo),
         private.requisicao_ip(), private.requisicao_navegador()
    FROM public.unidades u WHERE u.id = v_pac.unidade_id;
  PERFORM private.registrar_auditoria('abrir_historico_encerrado', 'pacientes', p_paciente, v_pac.unidade_id,
    jsonb_build_object('valido_ate', v_ate));
  RETURN v_ate;
END $$;
REVOKE ALL ON FUNCTION public.abrir_historico_encerrado(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_historico_encerrado(uuid, text) TO authenticated;

-- ── a Auditoria do gestor passa a mostrar o motivo ──────────────────────────
DROP FUNCTION IF EXISTS public.acessos_prontuario_da_unidade(uuid, timestamptz, timestamptz, uuid, uuid);
CREATE OR REPLACE FUNCTION public.acessos_prontuario_da_unidade(
  p_unidade uuid, p_desde timestamptz DEFAULT now() - interval '7 days', p_ate timestamptz DEFAULT now(),
  p_perfil uuid DEFAULT NULL, p_paciente uuid DEFAULT NULL)
RETURNS TABLE (id uuid, criado_em timestamptz, profissional_id uuid, profissional_nome text, papel text,
               paciente_id uuid, paciente_nome text, tipo_acesso text, documento_tipo text, ip text, via_pedido boolean,
               motivo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT la.id, la.created_at, la.acessado_por, pf.nome_completo, la.papel, la.paciente_id, pa.nome,
         la.tipo_acesso, la.documento_tipo, host(la.ip),
         EXISTS (SELECT 1 FROM public.pedidos_acesso_prontuario pd
                 WHERE pd.solicitante_id = la.acessado_por AND pd.paciente_id = la.paciente_id
                   AND pd.status = 'aprovado' AND la.created_at BETWEEN pd.decidido_em AND pd.valido_ate),
         la.motivo
  FROM public.log_acesso_prontuario la
  JOIN public.perfis pf ON pf.id = la.acessado_por
  JOIN public.pacientes pa ON pa.id = la.paciente_id
  WHERE la.unidade_id = p_unidade
    AND la.created_at >= coalesce(p_desde, now() - interval '7 days')
    AND la.created_at <= coalesce(p_ate, now())
    AND (p_perfil IS NULL OR la.acessado_por = p_perfil)
    AND (p_paciente IS NULL OR la.paciente_id = p_paciente)
  ORDER BY la.created_at DESC
  LIMIT 1000;
END $$;
REVOKE ALL ON FUNCTION public.acessos_prontuario_da_unidade(uuid, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acessos_prontuario_da_unidade(uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;
